// Load route geometry on demand instead of sending all 21k points initially.

import { withBase } from '../../core/utils';
import type { RouteShape } from '../../../types/transit';

const cache = new Map<string, Promise<RouteShape | null>>();

const fetchShape = async (routeId: string): Promise<RouteShape | null> => {
    try {
        const response = await fetch(withBase(`data/transport/routes/shapes/${routeId}.json`));
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const shape = (await response.json()) as RouteShape;
        return Array.isArray(shape) && shape.length > 1 ? shape : null;
    } catch (error) {
        console.error(`Could not load route geometry for ${routeId}:`, error);
        return null;
    }
};

export const loadRouteShape = (routeId: string): Promise<RouteShape | null> => {
    const cached = cache.get(routeId);
    if (cached) {
        return cached;
    }

    const request = fetchShape(routeId);
    cache.set(routeId, request);
    return request;
};
