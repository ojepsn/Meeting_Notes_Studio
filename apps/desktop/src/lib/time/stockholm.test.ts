import { formatStockholmDate, formatStockholmTime, getStockholmDateTimeParts } from "./stockholm";

describe("stockholm time helpers", () => {
  it("uses the explicit Stockholm timezone for morning timestamps", () => {
    const value = new Date("2026-05-05T07:51:00.000Z");

    expect(formatStockholmDate(value)).toBe("2026-05-05");
    expect(formatStockholmTime(value)).toBe("09:51");
    expect(getStockholmDateTimeParts(value)).toMatchObject({
      year: 2026,
      month: 5,
      day: 5,
      hours: 9,
      minutes: 51,
    });
  });

  it("stays on the same Stockholm day late in the evening UTC", () => {
    const value = new Date("2026-05-05T21:30:00.000Z");

    expect(formatStockholmDate(value)).toBe("2026-05-05");
    expect(formatStockholmTime(value)).toBe("23:30");
  });
});
