# Kilomondo — Fahrzeug-Statistiken (PWA)

Eine edle, installierbare PWA, um Statistiken und Pflege-Tagebücher für mehrere
Fahrzeuge zu führen: **Kilometerstand**, **Verbrauch / Tankbuch**, **Reparaturbuch**
und **Reinigungs-/Pflegebuch** — inkl. Dashboard mit Kennzahlen und Diagrammen.

Daten liegen auf deinem Server (PostgreSQL). Benutzer werden von einem Admin
angelegt; Anmeldung per E-Mail + Passwort (argon2id-Hashing, serverseitige Sessions).

## Tech-Stack

- **Next.js 15** (App Router, TypeScript), Server Actions
- **PostgreSQL 16** + **Prisma ORM**
- **Tailwind CSS** + shadcn-artige UI, **Recharts**, **lucide-react**
- **Serwist** für Service-Worker / PWA
- Auth: eigene DB-Sessions (httpOnly-Cookie) + **argon2id**
- Auslieferung via **Docker Compose** (App + DB)

## Installation in einem Befehl (empfohlen)

Voraussetzung: **Docker** (inkl. Compose-Plugin) + `curl`. Der Installer lädt die
aktuelle Version von GitHub, erzeugt `.env` mit zufälligem DB-Passwort und
Session-Secret, fragt (falls Terminal) nach Admin-Zugang und startet alles:

```bash
curl -fsSL https://raw.githubusercontent.com/FelixLenz-Code/kilomondo/main/install.sh | bash
```

Installiert nach `./kilomondo` (über `KILOMONDO_DIR` änderbar). Danach läuft die App auf
`http://<server>:3000` (Port via `KILOMONDO_PORT`). Der generierte Admin und das
Passwort werden am Ende ausgegeben — notieren!

Führst du **denselben Befehl erneut** aus und es existiert bereits eine Installation,
aktualisiert der Installer sie automatisch (Daten & `.env` bleiben erhalten) — du
brauchst `update` also nicht zwingend.

### Update

Holt die neueste Version, **behält Daten und `.env`** (DB liegt im Docker-Volume):

```bash
curl -fsSL https://raw.githubusercontent.com/FelixLenz-Code/kilomondo/main/install.sh | bash -s -- update
# ...oder aus dem Installationsverzeichnis:
./kilomondo/install.sh update          # erzwingen: update --force
```

Weitere Befehle: `install.sh status` · `logs` · `uninstall [--purge]`.
Optionen per Umgebungsvariable: `KILOMONDO_DIR`, `KILOMONDO_REF` (Tag/Branch), `KILOMONDO_PORT`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `COOKIE_SECURE`.

<details>
<summary>Manuelle Alternative (ohne Installer)</summary>

```bash
# 1. Konfiguration anlegen
cp .env.example .env
nano .env        # Secrets, Admin-Zugang & DB-Passwort setzen

# 2. Starten (baut Image, startet DB + App, migriert & seedet Admin automatisch)
docker compose up -d --build

# 3. Öffnen
#    http://<server>:3000  (Port via APP_PORT in .env änderbar)
```
</details>

Beim ersten Start werden die DB-Migrationen angewendet und der Admin-Account aus
`ADMIN_EMAIL` / `ADMIN_PASSWORD` angelegt. Danach meldest du dich als Admin an und
legst unter **Admin → Benutzerverwaltung** weitere Nutzer an.

### Wichtige `.env`-Variablen

| Variable | Bedeutung |
|---|---|
| `DATABASE_URL` | Verbindung zur DB. Bei Compose: Host = `db`. |
| `POSTGRES_USER/PASSWORD/DB` | Zugangsdaten des DB-Containers. |
| `SESSION_SECRET` | Langer Zufallswert (`openssl rand -base64 48`). |
| `ADMIN_EMAIL/PASSWORD/NAME` | Erst-Admin (Seed). |
| `COOKIE_SECURE` | In Produktion hinter HTTPS auf `true` setzen. |
| `APP_PORT` | Host-Port der App (Container hört auf 3000). |

## HTTPS in Produktion

Die Session-Cookies werden mit `Secure` ausgeliefert, sobald `COOKIE_SECURE=true`.
Das setzt HTTPS voraus. Einfachste Variante ist ein **Caddy**-Reverse-Proxy, der
Zertifikate automatisch via Let's Encrypt holt — Beispiel `Caddyfile`:

```
deine-domain.de {
    reverse_proxy localhost:3000
}
```

```bash
# Caddy als Service oder Container davor schalten, dann in .env:
#   COOKIE_SECURE="true"
```

## Running in an LXC container (Proxmox)

Läuft Docker in einem **unprivilegierten LXC** (typisch bei Proxmox), schlägt der
Start oft so fehl:

```
Error response from daemon: failed to create task for container: ...
open sysctl net.ipv4.ip_unprivileged_port_start file: ... permission denied
```

Ursache: `runc` will beim Containerstart den sysctl
`net.ipv4.ip_unprivileged_port_start` setzen, darf das im unprivilegierten LXC
aber nicht. Zwei Wege beheben das:

1. **Privilegierter LXC mit Nesting** (empfohlen, am robustesten): Container
   privilegiert anlegen und unter *Options → Features* `nesting=1,keyctl=1`
   aktivieren.
2. **Unprivilegiert bleiben** — auf dem Proxmox-Host in
   `/etc/pve/lxc/<CTID>.conf` ergänzen:

   ```
   features: nesting=1,keyctl=1
   lxc.apparmor.profile: unconfined
   lxc.cgroup2.devices.allow: a
   lxc.cap.drop:
   lxc.mount.auto: proc:rw sys:rw
   ```

   Entscheidend ist `lxc.mount.auto: proc:rw sys:rw` (macht `/proc/sys`
   beschreibbar). Danach Container neu starten:
   `pct stop <CTID> && pct start <CTID>`. Hinweis: `apparmor unconfined` +
   `cap.drop:` lockern die Isolation — Variante 1 ist dann meist die sauberere Wahl.

Sizing-Empfehlung für den LXC: **2–4 vCPU, 4 GB RAM, 10–15 GB Disk** (der
PDF-/Animations-Render via headless Chromium und der `next build` sind die
speicherintensiven Schritte).

## Lokale Entwicklung

```bash
npm install
cp .env.example .env   # DATABASE_URL auf lokale DB (localhost) zeigen lassen

# Postgres lokal (z. B. via Docker):
docker run -d --name carlog-db -e POSTGRES_USER=carlog \
  -e POSTGRES_PASSWORD=carlog -e POSTGRES_DB=carlog -p 5432:5432 postgres:16-alpine

npx prisma migrate dev      # Migrationen anwenden
npm run db:seed             # Admin anlegen
npm run dev                 # http://localhost:3000
```

## Datenmodell (Kurzüberblick)

`User` → `Vehicle` (1:n) → je Fahrzeug: `FuelEntry`, `OdometerEntry`,
`RepairEntry`, `CleaningEntry`. Sessions in `Session`. Jeder Nutzer sieht nur
seine eigenen Fahrzeuge (Owner-Prüfung in allen Queries/Actions).

Verbrauch wird per **full-to-full**-Methode berechnet (Menge zwischen zwei
Voll-Tankungen / gefahrene Strecke × 100). Bei Elektro/Hybrid in kWh.

## Backup & Restore

```bash
# Backup
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql

# Restore
cat backup.sql | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
```

Das DB-Volume `db_data` persistiert Daten über Container-Neustarts hinweg.

## Update

```bash
git pull          # oder neue Dateien einspielen
docker compose up -d --build   # baut neu, Migrationen laufen automatisch
```

## Projektstruktur

```
src/
├─ app/                      # Routen (App Router)
│  ├─ login/                 # Anmeldung
│  └─ (app)/                 # geschützter Bereich (Garage, Fahrzeuge, Admin, Konto)
├─ actions/                  # Server Actions (auth, vehicles, entries, users)
├─ components/               # UI, Formulare, Charts, Navigation
├─ lib/
│  ├─ auth/                  # password (argon2), session, guards
│  ├─ db.ts                  # Prisma-Client
│  ├─ stats.ts               # Verbrauch/Kosten-Berechnung
│  └─ validation.ts          # zod-Schemas
└─ middleware.ts             # optimistischer Auth-Redirect
prisma/                      # schema, migrations, seed
```

## Sicherheit

- Passwörter: **argon2id**; generische Login-Fehler (keine User-Enumeration).
- Sessions: httpOnly + SameSite=Lax Cookies, serverseitig gespeichert & widerrufbar
  (z. B. bei Passwort-Reset oder Deaktivierung werden Sessions gelöscht).
- Middleware schützt alle Routen optimistisch; die echte Prüfung erfolgt
  serverseitig in jeder geschützten Seite/Action.
- Eingaben werden mit zod validiert.

## Hinweis zur KI-Unterstützung

Diese Software wurde vollständig mithilfe von Claude (einem KI-Assistenten von Anthropic) entwickelt. Der Autor hat die Anforderungen definiert, Entscheidungen getroffen und das Ergebnis geprüft — der Code selbst wurde durch den Dialog mit der KI generiert.

## Haftungsausschluss

Die Software wird so bereitgestellt, wie sie ist (as-is), ohne jegliche Garantie auf Korrektheit, Vollständigkeit oder Eignung für einen bestimmten Zweck. Der Autor übernimmt keinerlei Haftung für Schäden, Datenverluste oder sonstige Probleme, die durch die Verwendung dieser Software entstehen. Die Nutzung erfolgt auf eigene Verantwortung.

## Lizenz

© 2026 Felix Lenz.

Dieses Projekt steht unter der **Creative Commons Attribution-NonCommercial 4.0
International (CC BY-NC 4.0)** Lizenz. Du darfst es teilen und bearbeiten, solange du
den Urheber nennst und es **nicht kommerziell** nutzt. Den vollständigen Text findest du
in [`LICENSE`](./LICENSE) sowie unter
<https://creativecommons.org/licenses/by-nc/4.0/>.
