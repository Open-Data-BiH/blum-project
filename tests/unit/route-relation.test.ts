import { describe, expect, it } from 'vitest';
import { formatSpokenRouteRelation, parseRouteRelation } from '../../src/lib/route-relation';
import { renderRouteRelation } from '../../src/scripts/core/route-relation';

describe('route relation parsing', () => {
    it('splits arrow and hyphen direction labels into endpoints', () => {
        expect(parseRouteRelation('Lauš → Obilićevo')).toEqual({
            origin: 'Lauš',
            destination: 'Obilićevo',
            via: [],
        });
        expect(parseRouteRelation('Mađir - Nova bolnica')).toEqual({
            origin: 'Mađir',
            destination: 'Nova bolnica',
            via: [],
        });
        expect(parseRouteRelation('Lauš→Obilićevo')).toEqual({
            origin: 'Lauš',
            destination: 'Obilićevo',
            via: [],
        });
    });

    it('keeps intermediate places as via points', () => {
        expect(parseRouteRelation('Autobuska stanica - Lauš - Saračica')).toEqual({
            origin: 'Autobuska stanica',
            destination: 'Saračica',
            via: ['Lauš'],
        });
    });

    it('preserves parenthetical and hyphenated place names', () => {
        expect(parseRouteRelation('Centar (Pošta) → Petrićevac-naselje')).toEqual({
            origin: 'Centar (Pošta)',
            destination: 'Petrićevac-naselje',
            via: [],
        });
    });

    it('leaves labels without a direction separator untouched', () => {
        expect(parseRouteRelation('Kružna linija')).toBeNull();
    });

    it('builds localized spoken labels without arrow characters', () => {
        expect(
            formatSpokenRouteRelation('Autobuska stanica → Lauš → Saračica', {
                toLabel: 'prema',
                viaLabel: 'preko',
            }),
        ).toBe('Autobuska stanica prema Saračica, preko Lauš');
    });

    it('renders escaped endpoints around one decorative arrow', () => {
        const html = renderRouteRelation('<Centar> - Lauš - Saračica', {
            toLabel: 'prema',
            viaLabel: 'preko',
        });

        expect(html).toContain('&lt;Centar&gt;');
        expect(html).toContain('route-relation__endpoint--destination">Saračica');
        expect(html).toContain('fa-arrow-right-long');
        expect(html).toContain('aria-hidden="true"');
        expect(html).toContain('preko: Lauš');
        expect(html.match(/fa-arrow-right-long/g)).toHaveLength(1);
    });
});
