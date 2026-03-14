// Build-time helpers for operator display — shared between lines.astro and [lineId].astro

const COMPANY_CLASS_MAP: Record<string, string> = {
    AUTOPREVOZ: 'autoprevoz-line',
    PAVLOVIC: 'pavlovic-line',
    BOCAC: 'bocac-line',
    ALDEMO: 'aldemo-line',
    RALE: 'rale-line',
};

const SHORT_OPERATOR_MAP: Record<string, string> = {
    AUTOPREVOZ: 'Autoprevoz',
    PAVLOVIC: 'Pavlović',
    BOCAC: 'Bočac',
    ALDEMO: 'Aldemo',
    RALE: 'Rale',
};

const normalizeCompanyName = (name: string): string =>
    name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

export const getCompanyClass = (companyName: string | null): string => {
    const normalized = normalizeCompanyName(companyName ?? '');
    const found = Object.entries(COMPANY_CLASS_MAP).find(([key]) => normalized.includes(key));
    return found ? found[1] : '';
};

export const getShortOperatorName = (companyName: string | null): string => {
    if (!companyName) {
        return '';
    }
    const normalized = normalizeCompanyName(companyName);
    const found = Object.entries(SHORT_OPERATOR_MAP).find(([key]) => normalized.includes(key));
    return found ? found[1] : companyName.split('"')[1] || companyName;
};
