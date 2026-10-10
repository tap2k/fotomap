'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { MAP_STYLE } from '@/lib/style';
import type { ChannelSettings } from '@/lib/types';

export type MapPoint = { id: string; lat: number; lng: number; color: string; isChannel?: boolean };
export type Focus = { lat: number; lng: number; zoom?: number; bearing?: number; pitch?: number };

type Props = {
  points: MapPoint[];
  overlays?: ChannelSettings['overlays'];
  styleUrl?: string;
  initial?: Focus | null;
  focus?: Focus | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
  cluster?: boolean;
  interactive?: boolean;
  className?: string;
};

const toGeoJson = (points: MapPoint[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: points.map((p) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: { id: p.id, color: p.color, isChannel: !!p.isChannel },
  })),
});

/** The one MapLibre wrapper: clustered points, image overlays, fly-to focus, click-to-place. */
export default function MapCanvas({
  points,
  overlays = [],
  styleUrl,
  initial,
  focus,
  selectedId,
  onSelect,
  onMapClick,
  cluster = true,
  interactive = true,
  className = '',
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const handlers = useRef({ onSelect, onMapClick });
  handlers.current = { onSelect, onMapClick };
  const latest = useRef({ points, overlays, selectedId });
  latest.current = { points, overlays, selectedId };

  // Create the map once per style.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: styleUrl || MAP_STYLE,
      center: initial ? [initial.lng, initial.lat] : [0, 20],
      zoom: initial?.zoom ?? (initial ? 10 : 1.5),
      bearing: initial?.bearing ?? 0,
      pitch: initial?.pitch ?? 0,
      interactive,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('points', { type: 'geojson', data: toGeoJson(latest.current.points), cluster, clusterRadius: 40 });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'points',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1d2327',
          'circle-opacity': 0.8,
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'points',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': '#fff' },
      });
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'isChannel'], 11, 8],
          'circle-stroke-width': ['case', ['get', 'isChannel'], 4, 2],
          'circle-stroke-color': '#fff',
        },
      });
      map.addLayer({
        id: 'selected',
        type: 'circle',
        source: 'points',
        filter: ['==', ['get', 'id'], latest.current.selectedId ?? ''],
        paint: { 'circle-radius': 14, 'circle-color': 'transparent', 'circle-stroke-width': 3, 'circle-stroke-color': '#1d2327' },
      });
      ready.current = true;
      syncOverlays(map, latest.current.overlays ?? []);
      if (!initial) fitTo(map, latest.current.points);
    });

    map.on('click', 'clusters', async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const zoom = await (map.getSource('points') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });
    map.on('click', 'points', (e) => {
      const id = e.features?.[0]?.properties.id;
      if (id) handlers.current.onSelect?.(id);
    });
    map.on('click', (e) => {
      if (map.queryRenderedFeatures(e.point, { layers: ['points', 'clusters'] }).length) return;
      handlers.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    for (const layer of ['points', 'clusters']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
    }
    return () => {
      ready.current = false;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, cluster, interactive]);

  useEffect(() => {
    if (ready.current) (mapRef.current?.getSource('points') as GeoJSONSource | undefined)?.setData(toGeoJson(points));
  }, [points]);

  useEffect(() => {
    if (ready.current) mapRef.current?.setFilter('selected', ['==', ['get', 'id'], selectedId ?? '']);
  }, [selectedId]);

  useEffect(() => {
    if (ready.current && mapRef.current) syncOverlays(mapRef.current, overlays ?? []);
  }, [overlays]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [focus.lng, focus.lat],
      zoom: focus.zoom ?? Math.max(mapRef.current.getZoom(), 12),
      bearing: focus.bearing ?? 0,
      pitch: focus.pitch ?? 0,
      duration: 2000,
      essential: true,
    });
  }, [focus]);

  return <div ref={container} className={`h-full w-full ${className}`} />;
}

function fitTo(map: maplibregl.Map, points: MapPoint[]) {
  if (!points.length) return;
  if (points.length === 1) return map.jumpTo({ center: [points[0].lng, points[0].lat], zoom: 12 });
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const bounds: LngLatBoundsLike = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
  map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
}

function syncOverlays(map: maplibregl.Map, overlays: NonNullable<ChannelSettings['overlays']>) {
  for (let i = 0; map.getSource(`overlay-${i}`); i++) {
    map.removeLayer(`overlay-${i}`);
    map.removeSource(`overlay-${i}`);
  }
  overlays.forEach((o, i) => {
    map.addSource(`overlay-${i}`, {
      type: 'image',
      url: o.url,
      coordinates: o.corners.map((c) => [c.lng, c.lat]) as [[number, number], [number, number], [number, number], [number, number]],
    });
    map.addLayer({ id: `overlay-${i}`, type: 'raster', source: `overlay-${i}`, paint: { 'raster-opacity': o.opacity } }, 'clusters');
  });
}
