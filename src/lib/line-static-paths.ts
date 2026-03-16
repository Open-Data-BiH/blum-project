import ownershipData from '../../public/data/transport/routes/urban_company_ownership.json';
import type { CompanyOwnership, Line } from '../types/lines';

export interface LineStaticPathProps {
    originalLineId: string;
    line: Line;
    companyName: string;
}

export const getLineStaticPaths = (): Array<{ params: { lineId: string }; props: LineStaticPathProps }> => {
    const data = ownershipData as CompanyOwnership;
    const paths: Array<{ params: { lineId: string }; props: LineStaticPathProps }> = [];

    data.urban.forEach((company) => {
        company.lines.forEach((line) => {
            paths.push({
                params: { lineId: line.lineId.toLowerCase() },
                props: {
                    originalLineId: line.lineId,
                    line,
                    companyName: company.companyName,
                },
            });
        });
    });

    return paths;
};
