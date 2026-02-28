// Type definitions for contact data

export interface LocalizedString {
    bhs: string;
    en: string;
}

export interface Contact {
    id: string;
    name: LocalizedString;
    department: LocalizedString;
    type: LocalizedString;
    phoneDisplay?: string | null;
    email?: string | null;
    website?: string | null;
    color?: string | null;
}

export interface ContactsFile {
    contacts: Contact[];
}
