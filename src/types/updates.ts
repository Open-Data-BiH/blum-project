export interface Category {
    id: string;
    icon: string;
    label: { bhs: string; en: string };
}

export interface Update {
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'urgent';
    title: { bhs: string; en: string };
    description: { bhs: string; en: string };
    affectedLines: string[];
    datePublished: string;
    dateExpiry: string | null;
    isActive: boolean;
    source: string;
    sourceUrl: string;
}
