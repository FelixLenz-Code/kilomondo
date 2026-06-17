import "server-only";
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  cp,
  symlink,
  access,
} from "node:fs/promises";

/**
 * Server-side renderer that turns an uploaded GLB model into a short
 * "turntable" intro video (the car spins around its own axis and eases to a
 * 3/4 resting pose) plus a poster frame.
 *
 * Rendering happens in headless Chrome (via puppeteer) using three.js, frame
 * by frame and fully deterministic, then ffmpeg encodes the frames to MP4.
 * Both Chrome's WebGL (SwiftShader) and ffmpeg run without a GPU.
 */

export type RenderResult = { mp4: Buffer; poster: Buffer };

const WIDTH = Number(process.env.RENDER_W) || 1280;
const HEIGHT = Number(process.env.RENDER_H) || 720;
const FPS = Number(process.env.RENDER_FPS) || 30;
const FRAMES = Number(process.env.RENDER_FRAMES) || 75; // 2.5s
// Supersampling: render larger, then downscale with ffmpeg (lanczos) for clean
// anti-aliasing without the cost of MSAA under software WebGL.
const SS = Number(process.env.RENDER_SS) || 1.5;
const CW = Math.round((WIDTH * SS) / 2) * 2;
const CH = Math.round((HEIGHT * SS) / 2) * 2;
const FADE_S = 1.8;
const require = createRequire(import.meta.url);

/** three version-keyed cache of the browser assets we serve to the render page. */
let threeAssetsDir: string | null = null;

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy three's ESM build + the examples/jsm tree into a stable temp dir once,
 * so each render only has to write the model + HTML (the jsm tree is ~15MB).
 */
async function ensureThreeAssets(): Promise<string> {
  if (threeAssetsDir && (await exists(threeAssetsDir))) return threeAssetsDir;
  const revision = (await import("three")).REVISION;
  // require.resolve("three") -> <root>/build/three.cjs ; go up to the package root.
  const threeRoot = path.resolve(path.dirname(require.resolve("three")), "..");
  const dir = path.join(os.tmpdir(), `carlog-three-${revision}`);
  if (!(await exists(path.join(dir, "index-ready")))) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    // three.module.js imports sibling chunks (three.core.js) -> copy the whole build dir.
    await cp(path.join(threeRoot, "build"), path.join(dir, "build"), { recursive: true });
    await cp(path.join(threeRoot, "examples", "jsm"), path.join(dir, "jsm"), {
      recursive: true,
    });
    await writeFile(path.join(dir, "index-ready"), "ok");
  }
  threeAssetsDir = dir;
  return dir;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".png": "image/png",
};

/** Tiny static server over a directory; ES modules need correct MIME + same-origin. */
function serveDir(rootDir: string): Promise<{ port: number; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        port,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

/** The HTML + module script Chrome runs to render each frame deterministically. */
function renderPageHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#121418;overflow:hidden}canvas{display:block}
  </style>
  <script type="importmap">{"imports":{"three":"/build/three.module.js","three/addons/":"/jsm/"}}</script>
  </head><body>
  <canvas id="c" width="${CW}" height="${CH}"></canvas>
  <script type="module">
  import * as THREE from "three";
  import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
  import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
  import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

  const W = ${CW}, H = ${CH};
  // Quarter turn, clockwise (negative Y), easing to the resting pose.
  let pivot, renderer, scene, camera, START = 0, TOTAL = -Math.PI / 2;

  async function init() {
    const canvas = document.getElementById("c");
    // MSAA is very slow under software WebGL; render aliased and let the H.264
    // chroma subsampling + the small display size hide it.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    // Neutral (Khronos PBR) tone mapping keeps colour/saturation far better than
    // ACES, which washes a near-neutral paint out to greyscale.
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    // Matches the app's card surface (.glass over --background) so there is no
    // visible seam between the video and the panel around the car name.
    scene.background = new THREE.Color(0x121418);

    // Coloured gradient environment (cool sky above, warm ground below). The
    // metallic/clearcoat paint reflects it, giving the neutral anthracite real
    // colour/life instead of a flat greyscale look. Only reflections are
    // affected — the solid background above stays app-matched.
    const envCanvas = document.createElement("canvas");
    envCanvas.width = 16; envCanvas.height = 256;
    const ectx = envCanvas.getContext("2d");
    const grad = ectx.createLinearGradient(0, 0, 0, 256);
    // Medium-bright studio with clear cool-blue sky and warm ground tints. The
    // glossy clearcoat reflects these, giving the dark anthracite colour/life.
    grad.addColorStop(0.0, "#5878be");   // sky – cool blue
    grad.addColorStop(0.42, "#9bb0d6");  // upper – cool
    grad.addColorStop(0.5, "#dcdee4");   // horizon – light
    grad.addColorStop(0.62, "#8d97a6");  // ground – cool neutral (no warm tint)
    grad.addColorStop(1.0, "#383d45");   // ground – dark cool neutral
    ectx.fillStyle = grad;
    ectx.fillRect(0, 0, 16, 256);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.colorSpace = THREE.SRGBColorSpace;
    envTex.needsUpdate = true;
    // Bake the gradient by rendering a sky sphere into the PMREM (the reliable
    // path in headless WebGL; fromEquirectangular came through empty here).
    const envScene = new THREE.Scene();
    envScene.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(100, 40, 40),
        new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide })
      )
    );
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene).texture;
    scene.environmentIntensity = 0.7;

    camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);

    // Warm key + cool fill + warm rim: gives the neutral paint lifelike coloured
    // reflections (like a real photo) without changing its actual colour.
    const key = new THREE.DirectionalLight(0xfff6ec, 1.5); // gently warm
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 6;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0004;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xaecbff, 0.6); // cool fill from the left
    fill.position.set(-6, 3, 3);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe9d0, 0.5); // warm rim from behind
    rim.position.set(-3, 4, -6);
    scene.add(rim);

    // Slightly cool ambient → warm light / cool shadow split-tone.
    scene.add(new THREE.AmbientLight(0xc2cdff, 0.12));

    pivot = new THREE.Group();
    scene.add(pivot);

    const loader = new GLTFLoader();
    const draco = new DRACOLoader().setDecoderPath("/jsm/libs/draco/");
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const gltf = await loader.loadAsync("/model.glb");
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      // Transmission (glass) forces a costly extra render pass per frame and is
      // unusably slow under software WebGL — approximate it with cheap opacity.
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.transmission > 0) {
          m.transmission = 0;
          m.transparent = true;
          m.opacity = 0.5;
        }
      }
    });

    // Center on origin and scale to a consistent size.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.0 / maxDim;
    pivot.add(model);
    pivot.scale.setScalar(scale);

    // Soft ground shadow at the model's base.
    const groundY = (box.min.y - center.y) * scale;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.4 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = groundY;
    ground.receiveShadow = true;
    scene.add(ground);
    key.target = pivot;

    // Flat 3/4 view. Fit the camera to the model's bounding sphere with margin
    // so the whole car stays inside the frame even after object-cover cropping.
    const sphereR = (size.length() / 2) * scale;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const padding = 0.82; // tight crop so the car fills the frame
    const dist = (sphereR / Math.sin(vFov / 2)) * padding;
    const az = THREE.MathUtils.degToRad(42); // more turned-in 3/4 to use wide space
    const el = THREE.MathUtils.degToRad(12); // low elevation = flatter view
    const direction = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    );
    camera.position.copy(direction.multiplyScalar(dist));
    camera.lookAt(0, 0, 0);

    // Rest where the spin ends; spin starts a whole number of turns earlier.
    const FINAL_Y = THREE.MathUtils.degToRad(0);
    START = FINAL_Y - TOTAL;
    window.__ready = true;
  }

  window.__renderFrame = (t) => {
    // easeInOutCubic: starts and ends at zero velocity (no jerky start).
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    pivot.rotation.y = START + ease * TOTAL;
    renderer.render(scene, camera);
  };

  init().catch((e) => { window.__error = String(e && e.stack || e); });
  </script></body></html>`;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`))
    );
  });
}

/**
 * Render a GLB to an MP4 turntable intro + poster JPEG.
 * Throws if the model can't be loaded or the tools are unavailable.
 */
export async function renderVehicleAnimation(glb: Buffer): Promise<RenderResult> {
  const puppeteer = (await import("puppeteer")).default;
  const assets = await ensureThreeAssets();
  const work = await mkdtemp(path.join(os.tmpdir(), "carlog-render-"));
  const framesDir = path.join(work, "frames");

  const server = await serveDir(work);
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    await mkdir(framesDir, { recursive: true });
    await writeFile(path.join(work, "model.glb"), glb);
    await writeFile(path.join(work, "index.html"), renderPageHtml());
    // Serve the shared three assets without copying them per render.
    await symlink(path.join(assets, "build"), path.join(work, "build"));
    await symlink(path.join(assets, "jsm"), path.join(work, "jsm"));

    browser = await puppeteer.launch({
      headless: true,
      // In Docker we use the distro Chromium (PUPPETEER_EXECUTABLE_PATH); locally
      // puppeteer's own download is used when the env var is unset.
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swift-shader",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: CW, height: CH });
    await page.goto(`http://127.0.0.1:${server.port}/index.html`, {
      waitUntil: "load",
      timeout: 60000,
    });
    await page.waitForFunction("window.__ready === true || window.__error", { timeout: 60000 });
    const err = await page.evaluate(() => (window as unknown as { __error?: string }).__error);
    if (err) throw new Error(`Modell konnte nicht geladen werden: ${err}`);

    for (let i = 0; i < FRAMES; i++) {
      const t = FRAMES === 1 ? 1 : i / (FRAMES - 1);
      const dataUrl = (await page.evaluate((tt) => {
        (window as unknown as { __renderFrame: (t: number) => void }).__renderFrame(tt);
        return (document.getElementById("c") as HTMLCanvasElement).toDataURL("image/png");
      }, t)) as string;
      const png = Buffer.from(dataUrl.split(",")[1], "base64");
      await writeFile(path.join(framesDir, `f_${String(i).padStart(4, "0")}.png`), png);
      if (process.env.RENDER_DEBUG) console.error(`frame ${i + 1}/${FRAMES}`);
    }

    const mp4Path = path.join(work, "out.mp4");
    const posterPath = path.join(work, "poster.jpg");
    await run("ffmpeg", [
      "-y", "-framerate", String(FPS),
      "-i", path.join(framesDir, "f_%04d.png"),
      // Downscale the supersampled frames (anti-aliasing) and fade in from the
      // background colour so the car gently appears instead of snapping in.
      "-vf", `scale=${WIDTH}:${HEIGHT}:flags=lanczos,fade=t=in:st=0:d=${FADE_S}:color=0x121418`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "21",
      "-movflags", "+faststart", mp4Path,
    ]);
    await run("ffmpeg", [
      "-y", "-i", path.join(framesDir, `f_${String(FRAMES - 1).padStart(4, "0")}.png`),
      "-vf", `scale=${WIDTH}:${HEIGHT}:flags=lanczos`,
      "-q:v", "3", posterPath,
    ]);

    const [mp4, poster] = await Promise.all([readFile(mp4Path), readFile(posterPath)]);
    return { mp4, poster };
  } finally {
    if (browser) await browser.close().catch(() => {});
    await server.close().catch(() => {});
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
