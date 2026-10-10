# Fotomap

Collect photos, video, audio and notes from the field and share them as maps, slideshows, grids and scrolling stories. Built for participatory research: photovoice, participatory mapping, oral history, cultural probes.

This is Fotomap v2: a single Next.js app with an SQLite database. It replaces the Next.js 13 frontend and the Strapi backend.

## Quick start

```bash
npm install
cp .env.example .env     # defaults work for local development
npm run seed             # optional demo channel
npm run dev              # http://localhost:3000
```

Sign in with any email. Without SMTP configured, the sign-in link is printed in the terminal. After `npm run seed`, sign in as `demo@example.org` to see the demo channel.

The database (`.data/fotomap.db`) is created and migrated automatically on startup. Uploads go to `.data/uploads` unless S3 is configured.

## How it works

| Concept | What it is |
|---|---|
| **Channel** | A project. It holds items and can contain sub-channels. Visibility: private, unlisted or public. |
| **Item** | A photo, video, audio clip, link (YouTube, Vimeo, any URL) or text card, with an optional location, tags, caption and narration. Status: published, draft or pending. |
| **Grant** | Who can do what. Either a person (owner, editor, viewer) or a share link (editor, viewer, submitter). Grants on a channel apply to all of its sub-channels. |
| **Views** | Map, slideshow (`reel`), grid and story, all rendered from the same channel data. `/embed/...` gives the same views without page chrome, for iframes. |

Typical flow: create a channel, create a **submission link** (or print its QR code) in *Sharing*, and let contributors send things from their phones without an account. Approve submissions in *Review*. Share the map or story, and export everything as CSV, GeoJSON or a ZIP.

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

This imports users (merged by email), channels (same `uniqueID`, so old public links keep working), content, tags and their colors, overlays, cover images, tilesets, owners and editors. Files are not copied; items keep pointing at their existing URLs. Old `privateID` links stop working by design: they could be forged. Owners create new share links in *Sharing*. Old `/map?channelid=…` and `/reel?channelid=…` URLs redirect.

## Development

```bash
npm run typecheck
npm test                 # unit + database tests (Vitest)
npm run e2e              # full browser flow (Playwright)
npm run db:generate      # after changing lib/db/schema.ts
```

## License

MIT
