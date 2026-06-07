import type { Update } from '../types/updates';

export function isUpdateVisible(update: Update, now: Date = new Date()): boolean {
    const startSource = update.dateStart ?? update.datePublished;
    if (startSource) {
        const start = new Date(startSource);
        start.setHours(0, 0, 0, 0);
        if (start > now) {
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
