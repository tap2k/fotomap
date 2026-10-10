'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Media from '@/components/Media';
import Text from '@/components/Text';
import { stillSeconds } from '@/lib/style';
import type { Channel } from '@/lib/types';

/** Full-screen slideshow: arrows/space/swipe, auto-advance, optional background music. */
export default function ReelView({ channel, start = 0 }: { channel: Channel; start?: number }) {
  const items = channel.items;
  const [index, setIndex] = useState(Math.min(Math.max(start, 0), Math.max(items.length - 1, 0)));
  const [playing, setPlaying] = useState(false);
  const [showCaption, setShowCaption] = useState(true);
  const music = useRef<HTMLAudioElement>(null);
  const touchX = useRef<number | null>(null);
  const item = items[index];

  const go = useCallback((d: number) => setIndex((i) => (i + d + items.length) % items.length), [items.length]);

  // Stills advance on a timer; video/audio/narrated items advance when they end.
  const timed = item && !(item.kind === 'video' || item.kind === 'audio' || item.audioUrl || (item.kind === 'embed' && !item.meta.duration));
  useEffect(() => {
    if (!playing || !timed) return;
    const t = setTimeout(() => go(1), stillSeconds(item, channel.settings) * 1000);
    return () => clearTimeout(t);
  }, [playing, timed, item, go, channel.settings]);

  useEffect(() => {
    if (!music.current) return;
    if (playing) music.current.play().catch(() => {});
    else music.current.pause();
  }, [playing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, video, audio')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'c') setShowCaption((s) => !s);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (!item) return <div className="flex h-full items-center justify-center text-muted">Nothing here yet.</div>;

  const hasText = item.kind !== 'text' && (item.title || item.caption);
  const align = item.meta.align === 'top' ? 'top-0' : item.meta.align === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-0';

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden bg-black text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div key={item.id} className="fade-in h-full w-full">
        <Media item={item} autoplay={playing} onEnded={() => playing && go(1)} />
      </div>
      {hasText && showCaption && (
        <div className={`pointer-events-none absolute inset-x-0 ${align} bg-gradient-to-t from-black/80 to-transparent px-6 pb-16 pt-10 sm:px-16`}>
          {item.title && <h2 className="text-xl font-semibold sm:text-2xl">{item.title}</h2>}
          <Text text={item.caption} className="mt-1 max-w-3xl text-sm sm:text-base" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
        <button className="btn border-white/20 bg-black/50 text-white" onClick={() => go(-1)} aria-label="Previous">‹</button>
        <button className="btn min-w-20 border-white/20 bg-black/50 text-white" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn border-white/20 bg-black/50 text-white" onClick={() => go(1)} aria-label="Next">›</button>
        <span className="ml-2 text-xs text-white/70">{index + 1} / {items.length}</span>
      </div>
      {channel.settings.audioUrl && <audio ref={music} src={channel.settings.audioUrl} loop />}
    </div>
  );
}
