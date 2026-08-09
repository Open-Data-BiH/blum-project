interface MonthDay {
    month: number; // 1-12
    day: number;
}

interface DateRange {
    from: MonthDay;
    to: MonthDay;
}

// Recurring school breaks. Update the movable Easter range annually.
const REDUCED_PERIODS: DateRange[] = [
    { from: { month: 6, day: 15 }, to: { month: 8, day: 31 } },
    // Winter break crosses the year boundary.
    { from: { month: 12, day: 27 }, to: { month: 12, day: 31 } },
    { from: { month: 1, day: 1 }, to: { month: 1, day: 14 } },
    // Approximate autumn break.
    { from: { month: 10, day: 28 }, to: { month: 11, day: 3 } },
    // Update annually for Easter.
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
