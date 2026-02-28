// Line manager — ported from js/features/lines/line-manager.js
// Key changes: FetchHelper replaced with fetch().then(r => r.json()), TypeScript types added

import { sortLinesByID } from '../../core/utils';
import type { CompanyOwnership, Line } from '../../../types/lines';

export interface LineConfig {
  enabled: boolean;
  dataFile: string;
  timetableFile: string;
  useCompanyData: boolean;
  title: { en: string; bhs: string };
}

export interface ProcessedLineData extends Line {
  companyName: string | null;
  lineType: string;
  hasMultilingualName: boolean;
}

export const LINE_CONFIG: Record<string, LineConfig> = {
  urban: {
    enabled: true,
    dataFile: '/data/transport/routes/urban_company_ownership.json',
    timetableFile: '/data/transport/timetables/urban_timetables.json',
    useCompanyData: true,
    title: {
      en: 'Urban Lines',
      bhs: 'Gradske linije',
    },
  },
};

export class LineManager {
  config: Record<string, LineConfig>;
  loadedData: Record<string, ProcessedLineData[]>;
  enabledTypes: string[];

  constructor(config = LINE_CONFIG) {
    this.config = config;
    this.loadedData = {};
    this.enabledTypes = Object.keys(config).filter((type) => config[type].enabled);
  }

  getEnabledTypes(): string[] {
    return this.enabledTypes;
  }

  async loadLineTypeData(lineType: string): Promise<ProcessedLineData[]> {
    const typeConfig = this.config[lineType];
    if (!typeConfig || !typeConfig.enabled) {
      throw new Error(`Line type '${lineType}' is not enabled or configured`);
    }

    try {
      const data: CompanyOwnership = await fetch(typeConfig.dataFile).then((r) => r.json());
      const processedLines = this.processLineData(data, lineType, typeConfig.useCompanyData);
      this.loadedData[lineType] = processedLines;
      return processedLines;
    } catch (error) {
      console.error(`Error loading ${lineType} lines:`, error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  processLineData(data: any, lineType: string, useCompanyData: boolean): ProcessedLineData[] {
    const lines: ProcessedLineData[] = [];

    if (useCompanyData) {
      const typeData = data[lineType] || [];
      typeData.forEach((company: { companyName: string; lines: Line[] }) => {
        company.lines.forEach((line) => {
          lines.push({
            ...line,
            companyName: company.companyName,
            lineType,
            hasMultilingualName: true,
          });
        });
      });
    } else {
      const typeData = data[lineType] || [];
      typeData.forEach((line: Line) => {
        lines.push({
          ...line,
          companyName: null,
          lineType,
          hasMultilingualName: false,
        });
      });
    }

    return lines.sort(sortLinesByID);
  }

  getLineName(line: ProcessedLineData, lang: string): string {
    if (line.hasMultilingualName && typeof line.lineName === 'object') {
      return (line.lineName as unknown as Record<string, string>)[lang] || line.lineName.en || line.lineName.bhs;
    }
    return typeof line.lineName === 'string' ? line.lineName : line.lineName.bhs;
  }

  async loadAllLines(): Promise<Record<string, ProcessedLineData[]>> {
    const loadPromises = this.enabledTypes.map((type) => this.loadLineTypeData(type));
    await Promise.all(loadPromises);
    return this.loadedData;
  }

  getLines(lineType: string): ProcessedLineData[] {
    return this.loadedData[lineType] || [];
  }

  getTypeTitle(lineType: string, lang: string): string {
    const typeConfig = this.config[lineType];
    return typeConfig ? (typeConfig.title as Record<string, string>)[lang] || typeConfig.title.en : lineType;
  }
}

export const lineManager = new LineManager();
