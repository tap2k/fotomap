# Fotomap v2

Single Next.js 16 (App Router, TypeScript) app. SQLite via Drizzle + libsql. No separate backend.

## Layout

```
app/                 pages and route handlers
  c/[slug]/[view]    public views: map | reel | grid | story
  embed/[slug]/[view] same, without chrome (iframes)
  edit/[id]          editor (owner/editor, or ?key= edit link)
  s/[token]          contributor submission page (submitter link)
  api/               JSON API (see below)
components/          React components
  views/             MapView, ReelView, GridView, StoryView (+ ChannelView switch)
  editor/            Editor shell (tabs: Content, Inbox, Collect, Design, More), ItemPanel, ShareDialog, TagsDialog
  Media, MapCanvas, Uploader, PlaceSearch, Modal, Toast, Text   shared building blocks
lib/
  db/schema.ts       the 4 tables: users, channels, items, grants (+ sessions, login_tokens)
  types.ts           zod schemas + the Channel/Item shapes every view consumes
  access.ts          can()/requireChannel(): the only permission check
  channel.ts         loadChannel(): builds the Channel shape
  items.ts           item ingestion: submissions, file accounting, positions
  plans.ts           tier limits (only when TIER_ENFORCEMENT=true)
  storage.ts         S3-compatible or local-folder storage
  upload.ts          browser-side resize/EXIF/upload pipeline
  migrate-strapi.ts  pure transform from the old Strapi tables
  templates.ts       new-project presets (settings only)
drizzle/             generated SQL migrations (applied on startup by instrumentation.ts)
scripts/             seed.ts, migrate-strapi.ts
tests/               vitest (*.test.ts) and Playwright (e2e/)
```

## Rules of the codebase

- **One way to do each thing.** Permissions go through `requireChannel`/`can`. API calls from the browser go through `lib/api.ts`. Media display goes through `components/Media.tsx`. Maps go through `components/MapCanvas.tsx`. Every view takes the same `Channel`.
- **Validate at the edge with zod** (`lib/types.ts`). URLs must pass `safeUrl` (http(s) or our `/api/files/`).
- **Route handlers** are wrapped in `route()` (`lib/http.ts`). Throw `fail(status, message)` for expected errors.
- **Grants are inherited** from ancestors (recursive CTE in `rolesFor`). Roles: owner > editor > viewer; submitter can only add pending items.
- **Plan limits follow the channel owner**, not the actor. They are off unless `TIER_ENFORCEMENT=true`.
- **File accounting is derived from URLs** (`keysOf`): the client never sends file keys or sizes; the server measures them.
- **Ordering uses fractional indexing** (`position` text keys); a reorder updates one row.
- **The UI says "project"; the code says `channel`.** Keep user-facing wording plain (Hidden/Visible, Inbox, Collect).
- **The editor autosaves.** Panels call `editor.updateItems` / `updateChannel` / `updateSettings` (optimistic, debounced, batched); the header shows Saving…/Saved. No Save buttons, no `alert()`/`prompt()` — use `useToast()` and `Modal`.
- **Branding is settings, not forks.** Welcome page, about text, font, analytics and custom domain live on the project (`settings.welcome/about/font/analyticsId`, `channels.domain`); `app/page.tsx` serves a project on its custom domain.
- Submissions are sanitised server-side (`sanitizeSubmission`): forced pending, location precision applied, consent enforced.

## Commands

```bash
npm run dev | build | start
npm run typecheck && npm test && npm run e2e
npm run db:generate   # after editing lib/db/schema.ts; commit the drizzle/ output
npm run seed          # demo data
```

In the cloud sandbox, run Playwright with `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
