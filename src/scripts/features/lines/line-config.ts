import { withBase } from '../../core/utils';
import type { Language } from '../../core/i18n';

export interface LineConfig {
    enabled: boolean;
    dataFile: string;
    timetableFile: string;
    useCompanyData: boolean;
    title: { en: string; bhs: string };
}

export const LINE_CONFIG: Record<string, LineConfig> = {
    urban: {
        enabled: true,
        dataFile: withBase('data/transport/routes/urban_company_ownership.json'),
        timetableFile: withBase('data/transport/timetables/urban_timetables.json'),
        useCompanyData: true,
        title: {
            en: 'Urban Lines',
            bhs: 'Gradske linije',
        },
    },
};

export const getLineTypeTitle = (lineType: string, lang: Language): string => {
    const typeConfig = LINE_CONFIG[lineType];
    if (!typeConfig) {
        return lineType;
    }
    return typeConfig.title[lang] || typeConfig.title.en;
};
