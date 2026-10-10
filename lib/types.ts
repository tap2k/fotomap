import { z } from 'zod';

// One source of truth for every shape that crosses the wire.

export const THEMES = ['light', 'dark', 'paper', 'ocean', 'forest', 'sunset'] as const;
export const VIEWS = ['map', 'reel', 'grid', 'story'] as const;
export const FONTS = ['sans', 'serif', 'rounded', 'script'] as const;
export type View = (typeof VIEWS)[number];

// Only http(s) links or our own stored files — never javascript:, data:, etc.
export const safeUrl = z
  .string()
  .max(2000)
  .refine((u) => /^(https?:\/\/|\/api\/files\/)/i.test(u), 'Must be an http(s) URL');

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const overlaySchema = z.object({
  url: safeUrl,
  opacity: z.number().min(0).max(1).default(0.8),
  // top-left, top-right, bottom-right, bottom-left
  corners: z.tuple([latLng, latLng, latLng, latLng]),
});

export const channelSettingsSchema = z
  .object({
    theme: z.enum(THEMES).optional(),
    defaultView: z.enum(VIEWS).optional(),
    mapStyle: safeUrl.optional(), // MapLibre style JSON, or a raster tile template with {z}/{x}/{y}
    mapAttribution: z.string().max(500).optional(),
    markerColor: z.string().optional(),
    tagColors: z.record(z.string(), z.string()).optional(),
    overlays: z.array(overlaySchema).optional(),
    coverUrl: safeUrl.optional(),
    audioUrl: safeUrl.optional(),
    interval: z.number().int().min(1).max(120).optional(), // reel seconds per still
    showTitle: z.boolean().optional(),
    font: z.enum(FONTS).optional(), // heading font
    welcome: z.object({ enabled: z.boolean().optional(), tagline: z.string().max(300).optional() }).optional(),
    about: z.string().max(20000).optional(), // "About" pop-up on public pages
    analyticsId: z.string().regex(/^G-[A-Z0-9]{4,20}$/).optional(), // Google Analytics 4
    submissions: z
      .object({
        prompt: z.string().max(2000).optional(),
        consent: z.string().max(4000).optional(),
        askName: z.boolean().optional(),
        locationPrecision: z.enum(['exact', 'approximate', 'none']).optional(),
      })
      .optional(),
  })
  .strict();
export type ChannelSettings = z.infer<typeof channelSettingsSchema>;

export const itemMetaSchema = z
  .object({
    is360: z.boolean().optional(),
    start: z.number().min(0).optional(), // video/audio trim start (s)
    duration: z.number().min(0).optional(), // seconds shown in reel
    align: z.enum(['top', 'center', 'bottom']).optional(),
    camera: z.object({ zoom: z.number(), bearing: z.number().optional(), pitch: z.number().optional() }).optional(),
    contributor: z.object({ name: z.string().max(200).optional(), consent: z.boolean().optional() }).optional(),
    note: z.string().max(10000).optional(), // private curator note, never published
  })
  .strict();
export type ItemMeta = z.infer<typeof itemMetaSchema>;

export const KINDS = ['image', 'video', 'audio', 'embed', 'text'] as const;
export type Kind = (typeof KINDS)[number];

// Fields a client may set on an item.
export const itemInputSchema = z.object({
  kind: z.enum(KINDS),
  url: safeUrl.nullish(),
  thumbUrl: safeUrl.nullish(),
  audioUrl: safeUrl.nullish(),
  title: z.string().max(500).optional(),
  caption: z.string().max(20000).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  takenAt: z.coerce.date().nullish(),
  status: z.enum(['draft', 'pending', 'published']).optional(),
  position: z.string().max(100).optional(),
  meta: itemMetaSchema.optional(),
});
export type ItemInput = z.infer<typeof itemInputSchema>;

export const itemPatchSchema = itemInputSchema.partial().extend({ id: z.string() });

export const channelInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).optional(),
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
  parentId: z.string().nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  zoom: z.number().min(0).max(24).nullish(),
  position: z.string().max(100).optional(),
  settings: channelSettingsSchema.optional(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, 'Enter a domain like stories.example.org')
    .nullish()
    .or(z.literal('').transform(() => null)),
});

// The one Channel shape every view, embed, export and the editor consume.
export type Item = {
  id: string;
  kind: Kind;
  status: 'draft' | 'pending' | 'published';
  position: string;
  url: string | null;
  thumbUrl: string | null;
  audioUrl: string | null;
  title: string;
  caption: string;
  tags: string[];
  lat: number | null;
  lng: number | null;
  takenAt: string | null;
  meta: ItemMeta;
};

export type ChildChannel = {
  id: string;
  slug: string;
  title: string;
  lat: number | null;
  lng: number | null;
  coverUrl: string | null;
};

export type Channel = {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: 'private' | 'unlisted' | 'public';
  lat: number | null;
  lng: number | null;
  zoom: number | null;
  domain: string | null;
  settings: ChannelSettings;
  parent: { slug: string; title: string } | null;
  children: ChildChannel[];
  items: Item[];
};
