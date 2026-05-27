# Fotomap

Multimedia content sharing platform with maps, slideshows, and grids. Built with Next.js 13 (Pages Router) + Reactstrap, backed by a Strapi headless CMS.

## Prerequisites

- Node.js 18+
- A running [Strapi backend](https://github.com/tap2k/fotomap-backend)

## Setup

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Create a `.env` file in the project root:

```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_STRAPI_HOST=http://127.0.0.1:1337
PRIVATE_SEED=<random-hex-string-for-channel-id-encryption>
```

3. Start the [Strapi backend](https://github.com/tap2k/fotomap-backend), then start this app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
