import { describe, expect, it } from 'vitest';
import { getCompanyClass, getShortOperatorName } from '../../src/lib/lineHelpers';

describe('line helpers', () => {
    it('maps operator to CSS class', () => {
        expect(getCompanyClass('PAVLOVIĆ TOURS')).toBe('pavlovic-line');
        expect(getCompanyClass('Unknown Operator')).toBe('');
    });

    it('returns short operator names', () => {
        expect(getShortOperatorName('AUTOPREVOZ AD BANJA LUKA')).toBe('Autoprevoz');
        expect(getShortOperatorName('Prevoznik "Test Company"')).toBe('Test Company');
        expect(getShortOperatorName(null)).toBe('');
    });
});
