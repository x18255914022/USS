import { dow } from "./dates.js";

const DOW: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс" };

function teacherLabel(t: any) {
  const u = t?.teacher?.user;
  if (!u) return "—";
  return `${u.lastName} ${u.firstName}`;
}

function roomLabel(r: any) {
  return r?.name ?? "—";
}

function audienceLabel(e: any) {
  const g = e.groups?.[0]?.group?.name;
  const sg = e.subgroups?.[0]?.subgroup?.group?.name;
  const stream = e.streamGroups?.[0]?.streamGroup?.name;
  return g || sg || stream || "—";
}

export function formatDaySchedule(payload: any, date: Date) {
  const day = dow(date);
  const items = (payload.items ?? []).filter((x: any) => Number(x.dayOfWeek) === day);

  if (!items.length) return `${DOW[day]}: пар нет`;

  const lines = items.map((e: any) => {
    const n = e.timeslot?.number ?? "—";
    const subj = e.subject?.code ?? "—";
    const lt = e.lessonType?.name ?? "—";
    const teachers = (e.teachers ?? []).map(teacherLabel).filter(Boolean).join(", ") || "—";
    const room = e.roomOverride ? `${roomLabel(e.room)} → ${roomLabel(e.roomOverride)}` : roomLabel(e.room);
    const aud = audienceLabel(e);
    const prefix = e.cancelled ? "❌ " : "";
    return `${prefix}№${n} ${subj} · ${lt}\n${teachers} · ${room} · ${aud}`;
  });

  return `${DOW[day]}:\n\n${lines.join("\n\n")}`;
}

export function formatWeekSchedule(payload: any) {
  const groups: Record<number, any[]> = {};
  for (const e of payload.items ?? []) {
    const d = Number(e.dayOfWeek);
    groups[d] = groups[d] ?? [];
    groups[d].push(e);
  }

  const days = [1, 2, 3, 4, 5, 6];
  const blocks = days.map((d) => {
    const list = (groups[d] ?? []).sort((a, b) => (a.timeslot?.number ?? 0) - (b.timeslot?.number ?? 0));
    if (!list.length) return `${DOW[d]}: пар нет`;
    const lines = list.map((e: any) => {
      const n = e.timeslot?.number ?? "—";
      const subj = e.subject?.code ?? "—";
      const room = e.roomOverride ? `${roomLabel(e.room)}→${roomLabel(e.roomOverride)}` : roomLabel(e.room);
      const prefix = e.cancelled ? "❌ " : "";
      return `${prefix}№${n} ${subj} · ${room}`;
    });
    return `${DOW[d]}:\n${lines.join("\n")}`;
  });

  return blocks.join("\n\n");
}
