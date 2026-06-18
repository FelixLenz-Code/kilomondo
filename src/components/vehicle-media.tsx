"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  status: "NONE" | "PENDING" | "READY" | "FAILED";
  videoId: string | null;
  posterId: string | null;
  coverImageId: string | null;
  alt: string;
  className?: string;
};

/**
 * Renders a vehicle's media: the 3D intro animation (plays once on load, then
 * holds the final frame) when ready, otherwise the cover image. While a render
 * is pending it shows a placeholder and refreshes the route until it's done.
 */
export function VehicleMedia({ status, videoId, coverImageId, alt, className }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "PENDING") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [status, router]);

  if (status === "READY" && videoId) {
    // No poster: the poster is the resting (end) frame and would flash before
    // playback starts. The video's own first frame is the background colour, so
    // a matching background makes the start seamless.
    return (
      <video
        className={className}
        style={{ backgroundColor: "#121418" }}
        src={`/api/images/${videoId}`}
        autoPlay
        muted
        playsInline
        preload="auto"
      />
    );
  }

  if (status === "PENDING") {
    return (
      <div className={`relative ${className ?? ""}`}>
        {coverImageId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${coverImageId}`} alt={alt} className="size-full object-cover" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 px-4 text-center text-sm text-muted-foreground backdrop-blur-sm">
          <span className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Animation wird erstellt …
          </span>
          <span className="text-xs">Dies kann einige Minuten in Anspruch nehmen.</span>
        </div>
      </div>
    );
  }

  if (coverImageId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={`/api/images/${coverImageId}`} alt={alt} />;
  }

  return null;
}
