import { describe, expect, it } from 'vitest';
import { getLineTypeTitle, LINE_CONFIG } from '../../src/scripts/features/lines/line-config';

describe('line config', () => {
    it('returns localized configured titles', () => {
        expect(getLineTypeTitle('urban', 'bhs')).toBe(LINE_CONFIG.urban.title.bhs);
        expect(getLineTypeTitle('urban', 'en')).toBe(LINE_CONFIG.urban.title.en);
    });

    it('falls back to line type for unknown config', () => {
        expect(getLineTypeTitle('unknown', 'en')).toBe('unknown');
    });
});
