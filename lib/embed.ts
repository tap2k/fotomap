// Isomorphic helpers for external links (YouTube, Vimeo, anything else).

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

export function vimeoId(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

/** iframe src for a link, or null if it can't be embedded. */
export function embedSrc(url: string, { autoplay = false, start = 0 } = {}): string | null {
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1${autoplay ? '&autoplay=1&mute=1' : ''}${start ? `&start=${Math.floor(start)}` : ''}`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}?${autoplay ? 'autoplay=1&muted=1' : ''}${start ? `#t=${Math.floor(start)}s` : ''}`;
  return null;
}

/** Best-effort thumbnail + title via the provider's oEmbed endpoint (server-side). */
export async function fetchEmbedInfo(url: string): Promise<{ title?: string; thumbUrl?: string }> {
  const yt = youtubeId(url);
  const endpoint = yt
    ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
    : vimeoId(url)
      ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`
      : null;
  if (!endpoint) return {};
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return yt ? { thumbUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` } : {};
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return { title: data.title, thumbUrl: data.thumbnail_url };
  } catch {
    return yt ? { thumbUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` } : {};
  }
}
