export class GeolocationService {
    constructor() {
        this.userLocation = null;
    }

    async getCurrentPosition() {
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
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0,
                },
            );
        });
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    findNearestStops(markers, limit = 3) {
        if (!this.userLocation || !markers || markers.length === 0) {
            return [];
        }

        const calculated = [];

        markers.forEach((marker) => {
            const latlng = marker.getLatLng();
            const distance = this.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                latlng.lat,
                latlng.lng,
            );

            calculated.push({
                marker,
                distance,
                lat: latlng.lat,
                lng: latlng.lng,
            });
        });

        calculated.sort((a, b) => a.distance - b.distance);
        return calculated.slice(0, limit);
    }
}
