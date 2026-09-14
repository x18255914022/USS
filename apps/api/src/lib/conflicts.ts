export type WeekType = "EVERY" | "UPPER" | "LOWER";

export function conflictWeekTypes(wt: WeekType): WeekType[] {
  if (wt === "EVERY") return ["EVERY", "UPPER", "LOWER"];
  return ["EVERY", wt];
}

