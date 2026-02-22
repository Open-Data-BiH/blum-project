import { FetchHelper } from '../../core/fetch-helper.js';
import { sortLinesByID } from '../../core/utils.js';

const LINE_CONFIG = {
    urban: {
        enabled: true,
        dataFile: 'data/transport/routes/urban_company_ownership.json',
        timetableFile: 'data/transport/timetables/urban_timetables.json',
        useCompanyData: true,
        title: {
            en: 'Urban Lines',
            bhs: 'Gradske linije',
        },
    },
};

class LineManager {
    constructor(config = LINE_CONFIG) {
        this.config = config;
        this.loadedData = {};
        this.enabledTypes = Object.keys(config).filter((type) => config[type].enabled);
    }

    getEnabledTypes() {
        return this.enabledTypes;
    }

    async loadLineTypeData(lineType) {
        const typeConfig = this.config[lineType];
        if (!typeConfig || !typeConfig.enabled) {
            throw new Error(`Line type '${lineType}' is not enabled or configured`);
        }

        try {
            const data = await FetchHelper.fetchJSON(typeConfig.dataFile);
            const processedLines = this.processLineData(data, lineType, typeConfig.useCompanyData);
            this.loadedData[lineType] = processedLines;
            return processedLines;
        } catch (error) {
            console.error(`Error loading ${lineType} lines:`, error);
            throw error;
        }
    }

    processLineData(data, lineType, useCompanyData) {
        const lines = [];

        if (useCompanyData) {
            const typeData = data[lineType] || [];
            typeData.forEach((company) => {
                company.lines.forEach((line) => {
                    lines.push({
                        lineId: line.lineId,
                        lineName: line.lineName,
                        companyName: company.companyName,
                        cooperatingCompanyName: line.cooperatingCompanyName,
                        group: line.group,
                        no_stops: line.no_stops,
                        min_duration: line.min_duration,
                        bus_type: line.bus_type,
                        wheelchair_accessible: line.wheelchair_accessible,
                        pdf_url: line.pdf_url,
                        hasMultilingualName: true,
                    });
                });
            });
        } else {
            const typeData = data[lineType] || [];
            typeData.forEach((line) => {
                lines.push({
                    lineId: line.lineId,
                    lineName: line.lineName,
                    companyName: null,
                    cooperatingCompanyName: null,
                    group: line.group,
                    no_stops: line.no_stops,
                    min_duration: line.min_duration,
                    bus_type: line.bus_type,
                    wheelchair_accessible: line.wheelchair_accessible,
                    pdf_url: line.pdf_url,
                    hasMultilingualName: false,
                });
            });
        }

        return lines.sort(sortLinesByID);
    }

    getLineName(line, lang) {
        if (line.hasMultilingualName && typeof line.lineName === 'object') {
            return line.lineName[lang] || line.lineName.en || line.lineName.bhs;
        }
        return line.lineName;
    }

    async loadAllLines() {
        const loadPromises = this.enabledTypes.map((type) => this.loadLineTypeData(type));
        await Promise.all(loadPromises);
        return this.loadedData;
    }

    getLines(lineType) {
        return this.loadedData[lineType] || [];
    }

    getTypeTitle(lineType, lang) {
        const typeConfig = this.config[lineType];
        return typeConfig ? typeConfig.title[lang] || typeConfig.title.en : lineType;
    }
}

const lineManager = new LineManager();

export { LINE_CONFIG, LineManager, lineManager };

