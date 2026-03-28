import { getHolidayName, isOffDay } from './holidays';
import { describe, it, expect } from 'vitest';

describe('Holiday Utility', () => {
    it('2025年の祝日と振替休日', () => {
        expect(getHolidayName('2025-01-01')).toBe('元日');
        expect(getHolidayName('2025-02-23')).toBe('天皇誕生日');
        expect(getHolidayName('2025-02-24')).toBe('振替休日');
        expect(isOffDay('2025-02-24')).toBe(true);
    });

    it('2026年のシルバーウィーク（国民の休日）', () => {
        expect(getHolidayName('2026-09-21')).toBe('敬老の日');
        expect(getHolidayName('2026-09-22')).toBe('国民の休日');
        expect(getHolidayName('2026-09-23')).toBe('秋分の日');
        expect(isOffDay('2026-09-22')).toBe(true);
    });

    it('2027年の振替休日', () => {
        expect(getHolidayName('2027-03-21')).toBe('春分の日');
        expect(getHolidayName('2027-03-22')).toBe('振替休日');
        expect(isOffDay('2027-03-22')).toBe(true);
    });

    it('2028年の祝日', () => {
        expect(getHolidayName('2028-05-05')).toBe('こどもの日');
        expect(isOffDay('2028-05-05')).toBe(true);
    });

    it('ユーザー指摘：2026年3月26日の判定', () => {
        // 2026-03-26 は木曜日
        expect(isOffDay('2026-03-26')).toBe(false);
    });

    it('土日の判定', () => {
        // 2026-03-14 (Sat)
        expect(isOffDay('2026-03-14')).toBe(true);
        // 2026-03-15 (Sun)
        expect(isOffDay('2026-03-15')).toBe(true);
        // 2026-03-16 (Mon)
        expect(isOffDay('2026-03-16')).toBe(false);
    });
});
