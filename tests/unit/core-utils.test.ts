import { describe, expect, it, vi } from 'vitest';
import { debounce, escapeHtml, normalizeForSearch, sortLinesByID } from '../../src/scripts/core/utils';

describe('core utils', () => {
    it('escapes HTML entities', () => {
        expect(escapeHtml(`<tag attr="x">&'`)).toBe('&lt;tag attr=&quot;x&quot;&gt;&amp;&#39;');
    });

    it('normalizes text for search', () => {
        const value = normalizeForSearch('  ŠĐĆŽ čćž! Đorđe Łódź  ');
        expect(value).toBe('sdcz ccz dorde lodz');
    });

    it('sorts line ids numerically when possible', () => {
        const sorted = [{ lineId: '10' }, { lineId: '2' }, { lineId: 'A1' }].sort(sortLinesByID);
        expect(sorted.map((item) => item.lineId)).toEqual(['2', '10', 'A1']);
    });

    it('debounces repeated calls', () => {
        vi.useFakeTimers();
        const spy = vi.fn();
        const debounced = debounce(spy, 200);

        debounced('first');
        debounced('second');
        vi.advanceTimersByTime(199);
        expect(spy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('second');
        vi.useRealTimers();
    });
});
