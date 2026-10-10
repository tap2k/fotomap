import type { NextConfig } from 'next';

const config: NextConfig = {
  // Docker builds set STANDALONE=1 for a minimal server bundle.
  output: process.env.STANDALONE ? 'standalone' : undefined,
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
  serverExternalPackages: ['@libsql/client'],
  async headers() {
    return [
      { source: '/((?!embed/).*)', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" }] },
      { source: '/embed/:path*', headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }] },
    ];
  },
  // Old public URLs (/map?channelid=X) keep working after migration.
  async redirects() {
    return ['map', 'reel', 'board', 'tagger'].map((view) => ({
      source: `/${view}`,
      has: [{ type: 'query', key: 'channelid', value: '(?<slug>.+)' }],
      destination: `/c/:slug/${view === 'reel' ? 'reel' : view === 'map' ? 'map' : 'grid'}`,
      permanent: true,
    }));
  },
};

export default config;
