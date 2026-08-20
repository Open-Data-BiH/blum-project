export interface RouteRelationParts {
    origin: string;
    destination: string;
    via: string[];
}

export interface RouteRelationLabels {
    toLabel: string;
    viaLabel: string;
}

/** Splits visual route labels while leaving hyphens inside place names untouched. */
export const parseRouteRelation = (relation: string): RouteRelationParts | null => {
    const parts = relation
        .trim()
        .split(/\s*→\s*|\s+-\s+/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length < 2) {
        return null;
    }

    return {
        origin: parts[0],
        destination: parts[parts.length - 1],
        via: parts.slice(1, -1),
    };
};

/** Produces a localized spoken label without asking assistive tech to pronounce an arrow glyph. */
export const formatSpokenRouteRelation = (
    relation: string,
    { toLabel, viaLabel }: RouteRelationLabels,
    suppliedParts?: RouteRelationParts,
): string => {
    const parts = suppliedParts ?? parseRouteRelation(relation);
    if (!parts) {
        return relation.trim();
    }

    const via = parts.via.length > 0 ? `, ${viaLabel} ${parts.via.join(', ')}` : '';
    return `${parts.origin} ${toLabel} ${parts.destination}${via}`;
};
