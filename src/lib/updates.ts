import type { Update } from '../types/updates';

export function isUpdateVisible(update: Update, now: Date = new Date()): boolean {
    if (update.datePublished) {
        const published = new Date(update.datePublished);
        published.setHours(0, 0, 0, 0);
        if (published > now) {
            return false;
        }
    }

    if (update.dateExpiry) {
        const expiry = new Date(update.dateExpiry);
        expiry.setHours(23, 59, 59, 999);
        if (expiry < now) {
            return false;
        }
    }

    return true;
}
