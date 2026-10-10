# Fotomap

Collect photos, video, audio and notes from the field and share them as maps, slideshows, grids and scrolling stories. Built for participatory research: photovoice, participatory mapping, oral history, cultural probes.

This is Fotomap v2: a single Next.js app with an SQLite database. It replaces the Next.js 13 frontend and the Strapi backend.

## Quick start

```bash
npm install
cp .env.example .env     # defaults work for local development
npm run seed             # optional demo project
npm run dev              # http://localhost:3000
```

Sign in with any email. Without SMTP configured, the sign-in link is printed in the terminal. After `npm run seed`, sign in as `demo@example.org` to see the demo project.

The database (`.data/fotomap.db`) is created and migrated automatically on startup. Uploads go to `.data/uploads` unless S3 is configured.

## How it works

| Concept | What it is |
|---|---|
| **Project** (`channel` in code) | Holds items and can contain sub-projects. Visibility: private, anyone with the link, or public. New projects start from a template (photo map, photovoice, participatory map, oral history, story map). |
| **Item** | A photo, video, audio clip, link (YouTube, Vimeo, any URL) or text card, with an optional location, tags, caption and narration. Status: published, draft or pending. |
| **Grant** | Who can do what. Either a person (owner, editor, viewer) or a share link (editor, viewer, submitter). Grants on a project apply to all of its sub-projects. |
| **Views** | Map, slideshow (`reel`), grid and story, all rendered from the same project data. `/embed/...` gives the same views without page chrome, for iframes. |

Typical flow: create a project from a template, turn on contributions in *Collect* (copy the link or print the QR code), and let participants send things from their phones without an account. Approve what arrives in *Inbox*, caption and tag it in *Content*, pick a look in *Design*, then press **Share**. Everything saves automatically. Export as CSV, GeoJSON or a ZIP from *More*.

**Website mode** (Design → Website): a project can have its own welcome page (full-screen cover, title, tagline, Enter), an About pop-up, a heading font, a Google Analytics ID and a custom domain (point a CNAME at the app; its `/` then shows the project). This replaces per-client forks like the old `bihar` branch of express-template with settings.

Heavy work happens in the browser: images are resized to web sizes, EXIF location, date and 360° info are read, and video thumbnails are captured. Files upload straight to storage through signed URLs. The server stores metadata and checks permissions and limits.

## Deploying

**One container (self-hosting):**

```bash
docker build -t fotomap .
docker run -p 3000:3000 -v fotomap-data:/app/.data \
  -e APP_URL=https://fotomap.example.org -e SECRET=$(openssl rand -hex 32) \
  -e SMTP_URL=smtp://user:pass@smtp.example.org:587 -e MAIL_FROM="Fotomap <noreply@example.org>" \
  fotomap
```

**Cheap hosted setup:** run the same container (or `npm run build && npm start`) on any small VM or container host. Store media in Cloudflare R2, which has no egress fees (`S3_*` variables). For a managed database, use Turso (`DATABASE_URL=libsql://...`). The default map tiles come from OpenFreeMap: free, no key. See `.env.example` for every setting.

## Migrating from the Strapi version

```bash
npm run db:migrate   # or just start the app once
STRAPI_DATABASE_URL=postgres://user:pass@host:5432/mvc \
STRAPI_MEDIA_URL=https://your-old-strapi-host \
npm run migrate:strapi
```

This imports users (merged by email), projects (same `uniqueID`, so old public links keep working), content, tags and their colors, overlays, cover images, tilesets, owners and editors. Files are not copied; items keep pointing at their existing URLs. Old `privateID` links stop working by design: they could be forged. Owners turn contributions back on in *Collect* and share again with **Share**. Old `/map?channelid=…` and `/reel?channelid=…` URLs redirect.

### Importing one project without database access

```bash
npm run import:channel -- --from https://old-host/strapi --channel bihar --owner you@example.org \
  --settings scripts/presets/bihar.json --domain bihar.represent.org
```

This reads a project (and its sub-projects) through the old server's public `getChannel` API and runs it through the same transform. Users and editors aren't public, so one owner is set. `scripts/presets/bihar.json` recreates the Represent Bihar site: welcome page, About text, script headings and a light base map.

## Not built yet

Billing (Stripe) and video generation are left for later. Plan limits exist (`lib/plans.ts`) but are off unless `TIER_ENFORCEMENT=true`.

## Development

```bash
npm run typecheck
npm test                 # unit + database tests (Vitest)
npm run e2e              # full browser flow (Playwright)
npm run db:generate      # after changing lib/db/schema.ts
```

## License

MIT
