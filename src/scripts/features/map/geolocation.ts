// Geolocation helper for Leaflet interactions

import type { CircleMarker, Marker } from 'leaflet';

export interface GeoPoint {
    lat: number;
    lng: number;
}

type MarkerLike = Marker | CircleMarker;

export class GeolocationService {
    private userLocation: GeoPoint | null = null;

    async getCurrentPosition(): Promise<GeoPoint> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    resolve(this.userLocation);
                },
                (error) => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                },
            );
        });
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const earthRadiusKm = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusKm * c;
    }

    findNearestStops(
        markers: MarkerLike[],
        limit = 3,
    ): Array<{ marker: MarkerLike; distance: number; lat: number; lng: number }> {
        if (!this.userLocation || markers.length === 0) {
            return [];
        }

        const calculated = markers.map((marker) => {
            const latlng = marker.getLatLng();
            const distance = this.calculateDistance(
                this.userLocation!.lat,
                this.userLocation!.lng,
                latlng.lat,
                latlng.lng,
            );
            return { marker, distance, lat: latlng.lat, lng: latlng.lng };
        });

        calculated.sort((a, b) => a.distance - b.distance);
        return calculated.slice(0, limit);
    }
}
