function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (type: string, fallback: string) => parts.find((p) => p.type === type)?.value ?? fallback;

  return {
    year: Number(get("year", "1970")),
    month: Number(get("month", "01")),
    day: Number(get("day", "01")),
    hour: Number(get("hour", "00")),
    minute: Number(get("minute", "00"))
  };
}

function addDaysToYmd(input: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(input.year, input.month - 1, input.day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + days);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function zonedToUtc(input: { timeZone: string; year: number; month: number; day: number; hour: number; minute: number }) {
  let guess = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0);

  for (let i = 0; i < 4; i++) {
    const p = getZonedParts(new Date(guess), input.timeZone);

    const want = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0, 0);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
    const diffMs = got - want;
    if (diffMs === 0) break;
    guess -= diffMs;
  }

  return new Date(guess);
}

export function computeQuietHoursDelayMs(input: {
  now: Date;
  timeZone: string;
  start: number | null;
  end: number | null;
}) {
  if (input.start === null || input.end === null) return null;
  if (!Number.isFinite(input.start) || !Number.isFinite(input.end)) return null;
  if (input.start === input.end) return null;

  const nowParts = getZonedParts(input.now, input.timeZone);
  const hour = nowParts.hour;
  const start = input.start;
  const end = input.end;

  const inQuiet = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  if (!inQuiet) return null;

  const dayShift = start < end ? 0 : hour < end ? 0 : 1;
  const ymd = dayShift ? addDaysToYmd(nowParts, dayShift) : { year: nowParts.year, month: nowParts.month, day: nowParts.day };

  const targetUtc = zonedToUtc({
    timeZone: input.timeZone,
    year: ymd.year,
    month: ymd.month,
    day: ymd.day,
    hour: end,
    minute: 0
  });

  const ms = targetUtc.getTime() - input.now.getTime();
  return ms > 0 ? ms : 0;
}

