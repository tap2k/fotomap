import type { ChannelSettings } from '@/lib/types';

// Starting points for a new project: just preset settings, editable afterwards.
export type Template = { id: string; name: string; blurb: string; description?: string; settings: ChannelSettings };

export const TEMPLATES: Template[] = [
  {
    id: 'map',
    name: 'Photo map',
    blurb: 'Put your photos, videos and sound on a map.',
    settings: { defaultView: 'map', theme: 'light' },
  },
  {
    id: 'photovoice',
    name: 'Photovoice',
    blurb: 'Participants photograph what matters to them and explain why.',
    description: 'Photos and stories from our community.',
    settings: {
      defaultView: 'grid',
      theme: 'paper',
      submissions: {
        prompt: 'Take a photo of something that matters to you in your community. Tell us what it shows and why you chose it.',
        consent: 'I took this photo and agree that it and my words may be shown publicly as part of this project.',
        askName: true,
        locationPrecision: 'approximate',
      },
    },
  },
  {
    id: 'mapping',
    name: 'Participatory map',
    blurb: 'Gather local knowledge about places, pinned where they are.',
    settings: {
      defaultView: 'map',
      theme: 'forest',
      submissions: {
        prompt: 'Add a place you know well. Share a photo, a voice note or a few words about it — and make sure the location is right.',
        consent: 'I agree that my contribution may be shown on the public map.',
        locationPrecision: 'exact',
      },
    },
  },
  {
    id: 'oral-history',
    name: 'Oral history',
    blurb: 'Record memories and testimony, connected to where they happened.',
    settings: {
      defaultView: 'story',
      theme: 'paper',
      submissions: {
        prompt: 'Record a memory about a place: what happened there, who was there, why it matters. Add a photo if you have one.',
        consent: 'I agree that my recording may be kept and shared as part of this oral history project.',
        askName: true,
        locationPrecision: 'approximate',
      },
    },
  },
  {
    id: 'story',
    name: 'Story map',
    blurb: 'Tell a story chapter by chapter as the map follows along.',
    settings: { defaultView: 'story', theme: 'light' },
  },
];
