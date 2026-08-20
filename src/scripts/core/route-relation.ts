import { parseRouteRelation, type RouteRelationParts } from '../../lib/route-relation';
import { escapeHtml } from './utils';

interface RenderRouteRelationOptions {
    className?: string;
    parts?: RouteRelationParts;
    toLabel: string;
    viaLabel: string;
}

export const renderRouteRelation = (
    relation: string,
    { className = '', parts: suppliedParts, toLabel, viaLabel }: RenderRouteRelationOptions,
): string => {
    const parts = suppliedParts ?? parseRouteRelation(relation);
    const classes = ['route-relation', className].filter(Boolean).join(' ');

    if (!parts) {
        return `<span class="${classes} route-relation--plain">${escapeHtml(relation)}</span>`;
    }

    const via =
        parts.via.length > 0
            ? `<span class="route-relation__via">${escapeHtml(viaLabel)}: ${parts.via.map(escapeHtml).join(' · ')}</span>`
            : '';

    return `<span class="${classes}" data-route-relation>
        <span class="route-relation__endpoint route-relation__endpoint--origin">${escapeHtml(parts.origin)}</span>
        <span class="route-relation__arrow">
            <i class="fas fa-arrow-right-long route-relation__arrow-icon" aria-hidden="true"></i>
            <span class="sr-only">${escapeHtml(toLabel)}</span>
        </span>
        <span class="route-relation__endpoint route-relation__endpoint--destination">${escapeHtml(parts.destination)}</span>
        ${via}
    </span>`;
};
