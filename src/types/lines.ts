// Type definitions for line/route data

export interface BilingualString {
    en: string;
    bhs: string;
}

export type BusType = 'solo' | 'minibus' | 'articulated';

export interface Line {
    lineId: string;
    lineName: BilingualString;
    cooperatingCompanyName: string | null;
    group: string;
    no_stops: number;
    min_duration: number;
    bus_type: BusType;
    wheelchair_accessible: boolean;
    pdf_url: string | null;
}

export interface CompanyGroup {
    companyName: string;
    lines: Line[];
}

export interface CompanyOwnership {
    urban: CompanyGroup[];
}

// Processed line card data (flat, with computed fields for SSR and client)
export interface ProcessedLine extends Line {
    companyName: string;
    lineType: string;
    hasMultilingualName: boolean;
    /** Pre-lowercased, diacritics-normalised string for search */
    searchText: string;
    /** CSS colour class derived from company name */
    companyClass: string;
    /** Short display name for the operator */
    shortOperator: string;
}
