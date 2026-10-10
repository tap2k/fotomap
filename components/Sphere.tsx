'use client';

import { useEffect, useRef } from 'react';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/video-plugin/index.css';

/** 360° photo or video viewer (equirectangular). Loaded client-side only. */
export default function Sphere({ url, video = false, autoplay = false }: { url: string; video?: boolean; autoplay?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let viewer: { destroy(): void } | null = null;
    let cancelled = false;
    (async () => {
      const { Viewer } = await import('@photo-sphere-viewer/core');
      if (cancelled || !ref.current) return;
      if (!video) {
        viewer = new Viewer({ container: ref.current, panorama: url, navbar: ['zoom', 'move', 'fullscreen'] });
        return;
      }
      const [{ EquirectangularVideoAdapter }, { VideoPlugin }] = await Promise.all([
        import('@photo-sphere-viewer/equirectangular-video-adapter'),
        import('@photo-sphere-viewer/video-plugin'),
      ]);
      if (cancelled || !ref.current) return;
      viewer = new Viewer({
        container: ref.current,
        adapter: EquirectangularVideoAdapter,
        panorama: { source: url },
        plugins: [[VideoPlugin, { autoplay, muted: autoplay }]],
        navbar: ['videoPlay', 'videoVolume', 'videoTime', 'fullscreen'],
      });
    })();
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [url, video, autoplay]);
  return <div ref={ref} className="h-full w-full" />;
}
