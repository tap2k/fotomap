import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@libsql/client'],
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
