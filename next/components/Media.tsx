'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { embedSrc } from '@/lib/embed';
import type { Item } from '@/lib/types';
import Text from '@/components/Text';

const Sphere = dynamic(() => import('@/components/Sphere'), { ssr: false });

type Props = {
  item: Item;
  /** thumb: small static preview. full: playable media. */
  mode?: 'thumb' | 'full';
  autoplay?: boolean;
  onEnded?: () => void;
  fit?: 'contain' | 'cover';
  className?: string;
};

/** The one place that knows how to show each kind of item. */
export default function Media({ item, mode = 'full', autoplay = false, onEnded, fit = 'contain', className = '' }: Props) {
  const objectFit = fit === 'cover' ? 'object-cover' : 'object-contain';

  if (mode === 'thumb') {
    const src = item.thumbUrl ?? (item.kind === 'image' ? item.url : null);
    if (src) return <img src={src} alt={item.title} loading="lazy" className={`h-full w-full ${objectFit} ${className}`} />;
    return (
      <div className={`flex h-full w-full items-center justify-center bg-card p-3 text-center text-sm text-muted ${className}`}>
        {item.kind === 'text' ? item.title || item.caption.slice(0, 80) : item.kind === 'audio' ? '♪ ' + (item.title || 'Audio') : item.title || item.kind}
      </div>
    );
  }

  const narration = item.audioUrl && item.kind !== 'audio' && (
    <Player kind="audio" src={item.audioUrl} autoplay={autoplay} onEnded={onEnded} className="absolute inset-x-2 bottom-2 w-[calc(100%-1rem)]" />
  );

  switch (item.kind) {
    case 'image':
      return (
        <div className={`relative h-full w-full ${className}`}>
          {item.meta.is360 ? (
            <Sphere url={item.url!} />
          ) : (
            <img src={item.url!} alt={item.title || item.caption.slice(0, 120)} className={`h-full w-full ${objectFit}`} />
          )}
          {narration}
        </div>
      );
    case 'video':
      return item.meta.is360 ? (
        <div className={`h-full w-full ${className}`}>
          <Sphere url={item.url!} video autoplay={autoplay} />
        </div>
      ) : (
        <Player
          kind="video"
          src={item.url!}
          poster={item.thumbUrl}
          start={item.meta.start}
          autoplay={autoplay}
          onEnded={onEnded}
          className={`h-full w-full ${objectFit} ${className}`}
        />
      );
    case 'audio':
      return (
        <div className={`relative flex h-full w-full items-center justify-center bg-card ${className}`}>
          {item.thumbUrl ? (
            <img src={item.thumbUrl} alt="" className={`h-full w-full ${objectFit}`} />
          ) : (
            <div className="text-6xl text-muted">♪</div>
          )}
          <Player kind="audio" src={item.url!} start={item.meta.start} autoplay={autoplay} onEnded={onEnded} className="absolute inset-x-2 bottom-2 w-[calc(100%-1rem)]" />
        </div>
      );
    case 'embed': {
      const src = embedSrc(item.url!, { autoplay, start: item.meta.start });
      return src ? (
        <iframe src={src} title={item.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className={`h-full w-full border-0 ${className}`} />
      ) : (
        <a href={item.url!} target="_blank" rel="noopener noreferrer nofollow" className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-card p-4 text-center ${className}`}>
          {item.thumbUrl && <img src={item.thumbUrl} alt="" className="max-h-[70%] object-contain" />}
          <span className="underline">{item.title || item.url}</span>
        </a>
      );
    }
    case 'text':
      return (
        <div className={`flex h-full w-full flex-col items-center justify-center overflow-auto p-8 text-center ${className}`}>
          {item.title && <h2 className="mb-4 text-3xl font-semibold">{item.title}</h2>}
          <Text text={item.caption} className="max-w-2xl text-lg" />
        </div>
      );
  }
}

function Player({
  kind,
  src,
  poster,
  start,
  autoplay,
  onEnded,
  className,
}: {
  kind: 'video' | 'audio';
  src: string;
  poster?: string | null;
  start?: number;
  autoplay?: boolean;
  onEnded?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (start) el.currentTime = start;
    if (autoplay) el.play().catch(() => {});
    else el.pause();
  }, [src, start, autoplay]);
  const Tag = kind;
  return (
    <Tag
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      onEnded={onEnded}
      className={className}
    />
  );
}
