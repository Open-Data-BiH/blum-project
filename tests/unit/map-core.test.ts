import { describe, expect, it } from 'vitest';
import { showWalkingRadius } from '../../src/scripts/features/map/map-core';

interface RecordedLayer {
    kind: 'circle' | 'marker';
    coordinates: unknown;
    options: Record<string, unknown>;
}

describe('walking radius', () => {
    it('uses the selected coordinate for the radius without drawing a second centre marker', () => {
        const layers: RecordedLayer[] = [];
        const coordinates: [number, number] = [44.7866, 17.1975];

        const recordLayer = (
            kind: RecordedLayer['kind'],
            layerCoordinates: unknown,
            options: Record<string, unknown>,
        ) => {
            const layer = {
                addTo: () => {
                    layers.push({ kind, coordinates: layerCoordinates, options });
                    return layer;
                },
            };
            return layer;
        };

        const leaflet = {
            circle: (layerCoordinates: unknown, options: Record<string, unknown>) =>
                recordLayer('circle', layerCoordinates, options),
            marker: (layerCoordinates: unknown, options: Record<string, unknown>) =>
                recordLayer('marker', layerCoordinates, options),
            divIcon: (options: Record<string, unknown>) => options,
        };
        const map = {
            removeLayer: () => undefined,
        };

        showWalkingRadius(leaflet as never, map as never, coordinates);

        expect(layers.find((layer) => layer.kind === 'circle')?.coordinates).toEqual(coordinates);
        expect(layers.filter((layer) => layer.kind === 'marker')).toHaveLength(1);
    });
});
