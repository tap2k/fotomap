import { BookOpen, LayoutGrid, Map, Presentation, type LucideIcon } from 'lucide-react';
import type { View } from '@/lib/types';

export const VIEW_LABELS: { view: View; label: string; hint: string; Icon: LucideIcon }[] = [
  { view: 'map', label: 'Map', hint: 'Everything with a location, on a map', Icon: Map },
  { view: 'reel', label: 'Slideshow', hint: 'One item at a time, full screen', Icon: Presentation },
  { view: 'grid', label: 'Grid', hint: 'A wall of thumbnails', Icon: LayoutGrid },
  { view: 'story', label: 'Story', hint: 'Scroll through chapters as the map follows', Icon: BookOpen },
];
