// Republika Srpska school holiday periods — reduced bus schedules apply during these dates.
// Update the REDUCED_PERIODS array each school year as needed.

interface MonthDay {
    month: number; // 1–12
    day: number;
}

interface DateRange {
    from: MonthDay;
    to: MonthDay;
}

// Year-agnostic recurring ranges (month/day only).
// Winter break spans Dec–Jan so it is split into two entries.
// Spring break (Easter) shifts each year — adjust the April range annually.
const REDUCED_PERIODS: DateRange[] = [
    // Summer break
    { from: { month: 6, day: 15 }, to: { month: 8, day: 31 } },
    // Winter break — December portion
    { from: { month: 12, day: 27 }, to: { month: 12, day: 31 } },
    // Winter break — January portion
    { from: { month: 1, day: 1 }, to: { month: 1, day: 14 } },
    // Autumn break (approximate — typically late Oct / early Nov)
    { from: { month: 10, day: 28 }, to: { month: 11, day: 3 } },
    // Spring / Easter break (approximate — adjust each year)
    { from: { month: 4, day: 14 }, to: { month: 4, day: 22 } },
];

function inRange(month: number, day: number, range: DateRange): boolean {
    const cur = month * 100 + day;
    const from = range.from.month * 100 + range.from.day;
    const to = range.to.month * 100 + range.to.day;
    return cur >= from && cur <= to;
}

export function isReducedScheduleDay(date: Date = new Date()): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return REDUCED_PERIODS.some((range) => inRange(month, day, range));
}
