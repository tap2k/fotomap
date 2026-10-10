import type { CSSProperties } from 'react';
import type { ChannelSettings } from '@/lib/types';

/** Attributes that apply a project's theme, heading font and brand color to a container. */
export function themeProps(settings: ChannelSettings) {
  const style: Record<string, string> = {};
  if (settings.accent) {
    style['--accent'] = settings.accent;
    style['--accent-fg'] = luminance(settings.accent) > 0.6 ? '#1d2327' : '#ffffff';
  }
  return { 'data-theme': settings.theme ?? 'light', 'data-font': settings.font ?? 'sans', style: style as CSSProperties };
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
