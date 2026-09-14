"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { apiFetch } from "../../../lib/apiFetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditorStore, type EditorEntry, type EditorConflict, type WeekType, type AudienceKind } from "../../../lib/editor/useEditorStore";

type PageResult<T> = { items: T[]; total: number; page: number; pageSize: number };
type ViewWeekType = WeekType | "BOTH";

type SemesterItem = { id: string; name: string; isActive: boolean };
type GroupItem = { id: string; name: string; subgroups?: { id: string; number: number }[] };
type StreamGroupItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; code: string };
type LessonTypeItem = { id: string; name: string; code: string; color: string };
type RoomItem = { id: string; name: string; capacity: number; hasComputers: boolean; buildingId: string };
type TeacherItem = { id: string; user: { firstName: string; lastName: string; email: string } };
type TimeslotItem = { id: string; number: number; startTime: string; endTime: string };

type EntryApiItem = {
  id: string;
  semesterId: string;
  dayOfWeek: number;
  weekType: WeekType;
  timeslot: TimeslotItem;
  subject: { id: string; code: string; name: string };
  lessonType: { id: string; code: string; name: string; color: string };
  room: { id: string; name: string } | null;
  teachers: { teacher: { id: string } }[];
  groups: { group: { id: string } }[];
  subgroups: { subgroup: { id: string } }[];
  streamGroups: { streamGroup: { id: string } }[];
  note: string | null;
};

type TeacherAvailabilityItem = {
  teacher: { id: string; user: { firstName: string; lastName: string; email: string } };
  available: boolean;
  busyWith: string | null;
  teachesSubject: boolean;
};

type RoomAvailabilityItem = {
  room: RoomItem;
  available: boolean;
  busyWith: string | null;
  capacitySufficient: boolean;
  typeOk: boolean;
};

const DOW: Record<number, string> = { 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб" };

function qsGet(sp: URLSearchParams, key: string) {
  const v = sp.get(key);
  return v && v.length ? v : null;
}

function parseViewWeekType(v: string | null): ViewWeekType {
  if (v === "UPPER" || v === "LOWER" || v === "BOTH") return v;
  return "UPPER";
}

function buildHref(params: Record<string, string | null | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length) usp.set(k, v);
  }
  const q = usp.toString();
  return q ? `/manager/editor?${q}` : "/manager/editor";
}

function cellId(dayOfWeek: number, timeslotId: string) {
  return `cell:${dayOfWeek}:${timeslotId}`;
}

function parseCell(id: string) {
  const m = id.match(/^cell:(\d+):(.+)$/);
  if (!m) return null;
  return { dayOfWeek: Number(m[1]), timeslotId: m[2] };
}

function entryDragId(id: string) {
  return `entry:${id}`;
}

function parseEntryId(id: string) {
  const m = id.match(/^entry:(.+)$/);
  return m ? m[1] : null;
}

function paletteId(id: string) {
  return `palette:${id}`;
}

function parsePaletteId(id: string) {
  const m = id.match(/^palette:(.+)$/);
  return m ? m[1] : null;
}

function createClientId() {
  return `c_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function splitAudience(a: string) {
  const [kind, id] = a.split(":");
  if (!id) return null;
  if (kind === "group" || kind === "subgroup" || kind === "stream") return { kind: kind as AudienceKind, id };
  return null;
}

function useDirty() {
  return useEditorStore((s) => Object.values(s.entries).some((e) => e._isNew || e._modified || e._moved || e._deleted));
}

function EntryCard({
  entry,
  subjectById,
  lessonTypeById,
  roomById,
  onClick
}: {
  entry: EditorEntry;
  subjectById: Map<string, SubjectItem>;
  lessonTypeById: Map<string, LessonTypeItem>;
  roomById: Map<string, RoomItem>;
  onClick: () => void;
}) {
  const s = subjectById.get(entry.subjectId);
  const lt = lessonTypeById.get(entry.lessonTypeId);
  const r = roomById.get(entry.roomId);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{s ? s.code : "—"}</div>
        {lt ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${lt.color}22`, color: lt.color }}>
            {lt.name}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        {r ? r.name : "—"}
        {entry.weekType !== "EVERY" ? ` · ${entry.weekType}` : ""}
        {entry._deleted ? " · удалено" : ""}
      </div>
    </button>
  );
}

function DndCell({
  id,
  children,
  highlighted,
  selected,
  dropVariant,
  onClick
}: {
  id: string;
  children: React.ReactNode;
  highlighted: boolean;
  selected: boolean;
  dropVariant: "valid" | "invalid" | "swap" | null;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const ring =
    highlighted ? "ring-2 ring-red-500" : dropVariant === "swap" ? "ring-2 ring-amber-400" : dropVariant === "invalid" ? "ring-2 ring-red-500" : dropVariant === "valid" ? "ring-2 ring-sky-400" : "";

  return (
    <div ref={setNodeRef} className={isOver ? "" : ""}>
      <button
        type="button"
        onClick={onClick}
        className={[
          "block w-full min-h-[78px] rounded-xl border px-3 py-2 text-left",
          selected ? "border-zinc-900" : "border-zinc-200 hover:bg-zinc-50",
          ring
        ].join(" ")}
      >
        {children}
      </button>
    </div>
  );
}

function PaletteDraggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function EntryDraggable({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = { transform: CSS.Translate.toString(transform) };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

function TrashZone({ activeId }: { activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: "trash" });
  const visible = !!activeId && !!parseEntryId(activeId);
  if (!visible) return null;
  return (
    <div ref={setNodeRef} className="mt-2">
      <div
        className={[
          "flex h-12 items-center justify-center rounded-xl border text-sm font-medium",
          isOver ? "border-red-400 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-700"
        ].join(" ")}
      >
        Перетащите сюда чтобы удалить
      </div>
    </div>
  );
}

export default function ManagerEditorPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const selectedSemesterId = qsGet(sp, "semesterId");
  const selectedGroupId = qsGet(sp, "groupId");
  const viewWeekType = parseViewWeekType(qsGet(sp, "weekType"));
  const effectiveWeekType: WeekType = viewWeekType === "BOTH" ? "UPPER" : viewWeekType;
  const initialEntryId = qsGet(sp, "entryId");

  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const semestersQ = useQuery({
    queryKey: ["semesters"],
    queryFn: () => apiFetch<PageResult<SemesterItem>>("/api/semesters?page=1&pageSize=100")
  });

  const groupsQ = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiFetch<PageResult<GroupItem>>("/api/groups?page=1&pageSize=100")
  });

  const resolvedSemesterId = selectedSemesterId ?? semestersQ.data?.items.find((s) => s.isActive)?.id ?? semestersQ.data?.items[0]?.id ?? null;
  const resolvedGroupId = selectedGroupId ?? groupsQ.data?.items[0]?.id ?? null;

  useEffect(() => {
    if (!resolvedSemesterId || !resolvedGroupId) return;
    if (selectedSemesterId && selectedGroupId) return;
    router.replace(
      buildHref({ semesterId: resolvedSemesterId, groupId: resolvedGroupId, weekType: viewWeekType })
    );
  }, [resolvedSemesterId, resolvedGroupId, selectedSemesterId, selectedGroupId, router, viewWeekType]);

  const subjectsQ = useQuery({
    queryKey: ["subjects"],
    queryFn: () => apiFetch<PageResult<SubjectItem>>("/api/subjects?page=1&pageSize=500")
  });

  const lessonTypesQ = useQuery({
    queryKey: ["lessonTypes"],
    queryFn: () => apiFetch<PageResult<LessonTypeItem>>("/api/lesson-types?page=1&pageSize=100")
  });

  const roomsQ = useQuery({
    queryKey: ["rooms"],
    queryFn: () => apiFetch<PageResult<RoomItem>>("/api/rooms?page=1&pageSize=500")
  });

  const teachersQ = useQuery({
    queryKey: ["teachers"],
    queryFn: () => apiFetch<PageResult<TeacherItem>>("/api/teachers?page=1&pageSize=500")
  });

  const streamGroupsQ = useQuery({
    queryKey: ["streamGroups"],
    queryFn: () => apiFetch<PageResult<StreamGroupItem>>("/api/stream-groups?page=1&pageSize=100")
  });

  const groupDetailsQ = useQuery({
    queryKey: ["group", resolvedGroupId],
    enabled: !!resolvedGroupId,
    queryFn: () => apiFetch<{ item: { subgroups: { id: string; number: number }[] } }>(`/api/groups/${encodeURIComponent(resolvedGroupId!)}`)
  });

  const timeslotsQ = useQuery({
    queryKey: ["timeslots", resolvedSemesterId],
    enabled: !!resolvedSemesterId,
    queryFn: async () => {
      const d = await apiFetch<{ item: { timeslotSets: { id: string; isDefault: boolean; timeslots: any[] }[] } }>(
        `/api/semesters/${encodeURIComponent(resolvedSemesterId!)}`
      );
      const set = d.item.timeslotSets.find((s) => s.isDefault) ?? d.item.timeslotSets[0];
      return (set?.timeslots ?? []).map((t: any) => ({
        id: String(t.id),
        number: Number(t.number),
        startTime: String(t.startTime),
        endTime: String(t.endTime)
      })) as TimeslotItem[];
    }
  });

  const entriesQ = useQuery({
    queryKey: ["scheduleEntries", resolvedSemesterId, resolvedGroupId],
    enabled: !!resolvedSemesterId && !!resolvedGroupId,
    queryFn: () =>
      apiFetch<PageResult<EntryApiItem>>(
        `/api/schedule/entries?semesterId=${encodeURIComponent(resolvedSemesterId!)}&groupId=${encodeURIComponent(resolvedGroupId!)}&page=1&pageSize=500`
      )
  });

  const conflictsQ = useQuery({
    queryKey: ["scheduleConflicts", resolvedSemesterId, resolvedGroupId],
    enabled: !!resolvedSemesterId && !!resolvedGroupId,
    queryFn: () =>
      apiFetch<{ items: EditorConflict[] }>(
        `/api/schedule/conflicts?semesterId=${encodeURIComponent(resolvedSemesterId!)}&groupId=${encodeURIComponent(resolvedGroupId!)}`
      )
  });

  const subjectById = useMemo(() => new Map((subjectsQ.data?.items ?? []).map((s) => [s.id, s] as const)), [subjectsQ.data]);
  const lessonTypeById = useMemo(() => new Map((lessonTypesQ.data?.items ?? []).map((s) => [s.id, s] as const)), [lessonTypesQ.data]);
  const roomById = useMemo(() => new Map((roomsQ.data?.items ?? []).map((s) => [s.id, s] as const)), [roomsQ.data]);

  const entries = useEditorStore((s) => s.entries);
  const selectedEntryId = useEditorStore((s) => s.selectedEntryId);
  const selectedCell = useEditorStore((s) => s.selectedCell);
  const conflicts = useEditorStore((s) => s.conflicts);
  const isSaving = useEditorStore((s) => s.isSaving);
  const loadEntries = useEditorStore((s) => s.loadEntries);
  const selectCell = useEditorStore((s) => s.selectCell);
  const selectEntry = useEditorStore((s) => s.selectEntry);
  const upsertEntry = useEditorStore((s) => s.upsertEntry);
  const moveEntry = useEditorStore((s) => s.moveEntry);
  const swapEntries = useEditorStore((s) => s.swapEntries);
  const removeEntry = useEditorStore((s) => s.removeEntry);
  const setConflicts = useEditorStore((s) => s.setConflicts);
  const setSaving = useEditorStore((s) => s.setSaving);
  const discardChanges = useEditorStore((s) => s.discardChanges);
  const applyCreatedMap = useEditorStore((s) => s.applyCreatedMap);
  const markSaved = useEditorStore((s) => s.markSaved);

  const isDirty = useDirty();

  useEffect(() => {
    if (!entriesQ.data || !resolvedSemesterId) return;
    const mapped: EditorEntry[] = entriesQ.data.items.map((e) => {
      const teacherId = e.teachers[0]?.teacher.id ?? "";
      const groupId = e.groups[0]?.group.id ?? null;
      const subgroupId = e.subgroups[0]?.subgroup.id ?? null;
      const streamId = e.streamGroups[0]?.streamGroup.id ?? null;
      const audienceKind: AudienceKind = groupId ? "group" : subgroupId ? "subgroup" : "stream";
      const audienceId = groupId ?? subgroupId ?? streamId ?? "";
      return {
        id: e.id,
        semesterId: e.semesterId,
        dayOfWeek: e.dayOfWeek,
        weekType: e.weekType,
        timeslotId: e.timeslot.id,
        subjectId: e.subject.id,
        lessonTypeId: e.lessonType.id,
        teacherId,
        roomId: e.room?.id ?? "",
        note: e.note ?? "",
        audienceKind,
        audienceId
      };
    });
    loadEntries(mapped);
  }, [entriesQ.data, loadEntries, resolvedSemesterId]);

  useEffect(() => {
    if (!initialEntryId) return;
    if (!entries[initialEntryId]) return;
    selectEntry(initialEntryId);
  }, [entries, initialEntryId, selectEntry]);

  useEffect(() => {
    if (!conflictsQ.data) return;
    setConflicts(conflictsQ.data.items);
  }, [conflictsQ.data, setConflicts]);

  const conflictEntryIds = useMemo(() => new Set(conflicts.flatMap((c) => [c.entryId, c.withEntryId].filter(Boolean) as string[])), [conflicts]);

  const entriesList = Object.values(entries).filter((e) => !e._deleted);
  const entriesByCell = useMemo(() => {
    const m = new Map<string, EditorEntry[]>();
    for (const e of entriesList) {
      if (viewWeekType !== "BOTH" && e.weekType !== "EVERY" && e.weekType !== viewWeekType) continue;
      const k = cellId(e.dayOfWeek, e.timeslotId);
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    }
    return m;
  }, [entriesList, viewWeekType]);

  const selectedEntry = selectedEntryId ? entries[selectedEntryId] ?? null : null;

  const saveAll = useCallback(async () => {
    if (!resolvedSemesterId || !resolvedGroupId) return;
    if (isSaving) return;

    const values = Object.values(useEditorStore.getState().entries);
    const ops: any[] = [];
    for (const e of values) {
      if (e._deleted) {
        if (!e._isNew) ops.push({ type: "delete", data: { id: e.id } });
        continue;
      }
      const payload: any = {
        semesterId: e.semesterId,
        dayOfWeek: e.dayOfWeek,
        weekType: e.weekType,
        timeslotId: e.timeslotId,
        subjectId: e.subjectId,
        lessonTypeId: e.lessonTypeId,
        teacherId: e.teacherId,
        roomId: e.roomId,
        note: e.note || undefined
      };
      if (e.audienceKind === "group") payload.groupId = e.audienceId;
      if (e.audienceKind === "subgroup") payload.subgroupId = e.audienceId;
      if (e.audienceKind === "stream") payload.streamGroupId = e.audienceId;

      if (e._isNew) {
        ops.push({ type: "create", data: { ...payload, clientId: e.id } });
      } else if (e._modified || e._moved) {
        ops.push({ type: "update", data: { ...payload, id: e.id } });
      }
    }

    if (!ops.length) return;

    setSaving(true);
    try {
      const res = await apiFetch<{ ok: boolean; created: { clientId: string; id: string }[] }>("/api/schedule/entries/batch", {
        method: "POST",
        body: JSON.stringify({ ops })
      });
      applyCreatedMap(res.created ?? []);
      markSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["scheduleEntries", resolvedSemesterId, resolvedGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["scheduleConflicts", resolvedSemesterId, resolvedGroupId] })
      ]);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      if (text.includes("conflicts")) {
        try {
          const parsed = JSON.parse(text) as { conflicts?: EditorConflict[] };
          setConflicts(parsed.conflicts ?? []);
        } catch {
          setConflicts([]);
        }
      }
      alert("Не удалось сохранить: конфликт или ошибка валидации.");
    } finally {
      setSaving(false);
    }
  }, [applyCreatedMap, isSaving, markSaved, queryClient, resolvedGroupId, resolvedSemesterId, setConflicts, setSaving]);

  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        void saveAll();
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        discardChanges();
        return;
      }
      if (ev.key === "Escape") {
        selectEntry(null);
        return;
      }
      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (selectedEntryId) removeEntry(selectedEntryId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [discardChanges, removeEntry, saveAll, selectEntry, selectedEntryId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handler = (ev: MouseEvent) => {
      if (!isDirty) return;
      const t = ev.target as HTMLElement | null;
      const a = t?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("/manager/editor")) return;
      const ok = window.confirm("Есть несохранённые изменения. Уйти со страницы?");
      if (!ok) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    root.addEventListener("click", handler, true);
    return () => root.removeEventListener("click", handler, true);
  }, [isDirty]);

  const palette = subjectsQ.data?.items ?? [];
  const [paletteQuery, setPaletteQuery] = useState("");
  const filteredPalette = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return palette;
    return palette.filter((s) => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [palette, paletteQuery]);

  function defaultAudience(): { kind: AudienceKind; id: string } | null {
    const group = resolvedGroupId;
    const sub = groupDetailsQ.data?.item.subgroups?.[0]?.id ?? null;
    const stream = streamGroupsQ.data?.items?.[0]?.id ?? null;
    if (group) return { kind: "group", id: group };
    if (sub) return { kind: "subgroup", id: sub };
    if (stream) return { kind: "stream", id: stream };
    return null;
  }

  function autoAudienceForLessonType(code: string): { kind: AudienceKind; id: string } | null {
    const group = resolvedGroupId;
    const sub = groupDetailsQ.data?.item.subgroups?.[0]?.id ?? null;
    const stream = streamGroupsQ.data?.items?.[0]?.id ?? null;
    if (code === "lecture" && stream) return { kind: "stream", id: stream };
    if (code === "lab" && sub) return { kind: "subgroup", id: sub };
    if (group) return { kind: "group", id: group };
    return defaultAudience();
  }

  function onCellClick(dayOfWeek: number, timeslotId: string) {
    selectCell({ dayOfWeek, timeslotId });
  }

  function openEntry(id: string) {
    selectEntry(id);
  }

  function handleDragEnd(ev: any) {
    setActiveId(null);
    const active = ev.active?.id as string | undefined;
    const over = ev.over?.id as string | undefined;
    if (!active || !over) return;

    if (over === "trash") {
      const eid = parseEntryId(active);
      if (eid) removeEntry(eid);
      return;
    }

    const target = parseCell(over);
    if (!target) return;

    const paletteSubjectId = parsePaletteId(active);
    if (paletteSubjectId) {
      const targetKey = cellId(target.dayOfWeek, target.timeslotId);
      const occupied = (entriesByCell.get(targetKey) ?? []).length > 0;
      if (occupied) return;
      if (!resolvedSemesterId || !resolvedGroupId) return;
      const id = createClientId();
      const defaultLessonType = lessonTypesQ.data?.items?.[0];
      const ltId = defaultLessonType?.id ?? "";
      const audience = autoAudienceForLessonType(defaultLessonType?.code ?? "lecture") ?? defaultAudience();
      if (!audience) return;

      const entry: EditorEntry = {
        id,
        semesterId: resolvedSemesterId,
        dayOfWeek: target.dayOfWeek,
        timeslotId: target.timeslotId,
        weekType: viewWeekType === "BOTH" ? "UPPER" : viewWeekType,
        subjectId: paletteSubjectId,
        lessonTypeId: ltId,
        teacherId: "",
        roomId: "",
        note: "",
        audienceKind: audience.kind,
        audienceId: audience.id,
        _isNew: true
      };
      upsertEntry(entry, { select: true });
      return;
    }

    const eid = parseEntryId(active);
    if (!eid) return;
    const existing = entries[eid];
    if (!existing) return;

    const targetKey = cellId(target.dayOfWeek, target.timeslotId);
    const cellEntries = entriesByCell.get(targetKey) ?? [];
    const occupied = cellEntries.find((e) => e.id !== eid);
    if (occupied) {
      swapEntries(eid, occupied.id);
      return;
    }
    moveEntry(eid, target);
  }

  const days = [1, 2, 3, 4, 5, 6];
  const timeslots = timeslotsQ.data ?? [];

  const selectedDay = selectedEntry?.dayOfWeek ?? selectedCell?.dayOfWeek ?? 1;
  const selectedSlot = selectedEntry?.timeslotId ?? selectedCell?.timeslotId ?? timeslots[0]?.id ?? "";

  const selectedWeekType: WeekType = selectedEntry?.weekType ?? effectiveWeekType;

  const teacherAvailabilityQ = useQuery({
    queryKey: ["teacherAvailability", resolvedSemesterId, selectedDay, selectedSlot, selectedWeekType, selectedEntry?.subjectId ?? ""],
    enabled: !!resolvedSemesterId && !!selectedSlot,
    queryFn: async () => {
      const qs = new URLSearchParams({
        dayOfWeek: String(selectedDay),
        timeslotId: selectedSlot,
        semesterId: resolvedSemesterId!,
        weekType: selectedWeekType,
        ...(selectedEntry?.subjectId ? { subjectId: selectedEntry.subjectId } : {})
      });
      const res = await apiFetch<{ items: TeacherAvailabilityItem[] }>(`/api/teachers/availability?${qs.toString()}`);
      return res.items;
    }
  });

  const roomAvailabilityQ = useQuery({
    queryKey: ["roomAvailability", resolvedSemesterId, selectedDay, selectedSlot, selectedWeekType, selectedEntry?.lessonTypeId ?? ""],
    enabled: !!resolvedSemesterId && !!selectedSlot,
    queryFn: async () => {
      const lt = selectedEntry ? lessonTypeById.get(selectedEntry.lessonTypeId) : null;
      const qs = new URLSearchParams({
        dayOfWeek: String(selectedDay),
        timeslotId: selectedSlot,
        semesterId: resolvedSemesterId!,
        weekType: selectedWeekType,
        ...(lt?.code ? { lessonTypeCode: lt.code } : {})
      });
      const res = await apiFetch<{ items: RoomAvailabilityItem[] }>(`/api/rooms/availability?${qs.toString()}`);
      return res.items;
    }
  });

  function updateSelected(patch: Partial<EditorEntry>) {
    if (!selectedEntry) return;
    const next: EditorEntry = { ...selectedEntry, ...patch, _modified: selectedEntry._isNew ? selectedEntry._modified : true };
    upsertEntry(next, { select: true });
  }

  const audienceOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    if (resolvedGroupId) {
      const name = groupsQ.data?.items.find((g) => g.id === resolvedGroupId)?.name ?? resolvedGroupId;
      opts.push({ value: `group:${resolvedGroupId}`, label: `Группа: ${name}` });
    }
    for (const s of groupDetailsQ.data?.item.subgroups ?? []) {
      opts.push({ value: `subgroup:${s.id}`, label: `Подгруппа ${s.number}` });
    }
    for (const sg of streamGroupsQ.data?.items ?? []) {
      opts.push({ value: `stream:${sg.id}`, label: `Поток: ${sg.name}` });
    }
    return opts;
  }, [groupDetailsQ.data, groupsQ.data, resolvedGroupId, streamGroupsQ.data]);

  const selectedAudienceValue = selectedEntry ? `${selectedEntry.audienceKind}:${selectedEntry.audienceId}` : audienceOptions[0]?.value ?? "";

  const activeDragOverlay = (() => {
    if (!activeId) return null;
    const sid = parsePaletteId(activeId);
    if (sid) {
      const s = subjectById.get(sid);
      return <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow">{s ? `${s.code} — ${s.name}` : "Предмет"}</div>;
    }
    const eid = parseEntryId(activeId);
    if (eid) {
      const e = entries[eid];
      if (!e) return null;
      return <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow">Перемещение</div>;
    }
    return null;
  })();

  return (
    <div ref={rootRef} className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Редактор расписания (v0.5)</h1>
        <p className="text-sm text-zinc-600">Drag & Drop, smart-селекторы, batch-save.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Семестр</span>
          <select
            className="h-11 w-80 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            value={resolvedSemesterId ?? ""}
            onChange={(e) => router.replace(buildHref({ semesterId: e.target.value, groupId: resolvedGroupId, weekType: viewWeekType }))}
          >
            {(semestersQ.data?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Группа</span>
          <select
            className="h-11 w-64 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            value={resolvedGroupId ?? ""}
            onChange={(e) => router.replace(buildHref({ semesterId: resolvedSemesterId, groupId: e.target.value, weekType: viewWeekType }))}
          >
            {(groupsQ.data?.items ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-zinc-700">Неделя</span>
          <select
            className="h-11 w-48 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
            value={viewWeekType}
            onChange={(e) => router.replace(buildHref({ semesterId: resolvedSemesterId, groupId: resolvedGroupId, weekType: e.target.value }))}
          >
            <option value="UPPER">UPPER</option>
            <option value="LOWER">LOWER</option>
            <option value="BOTH">BOTH</option>
          </select>
        </label>

        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() => void saveAll()}
          className={[
            "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium",
            isDirty ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-200 text-zinc-500"
          ].join(" ")}
        >
          {isSaving ? "Сохранение..." : "Сохранить (Ctrl+S)"}
        </button>

        <button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={() => discardChanges()}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
        >
          Сброс (Ctrl+Z)
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr_360px]">
          <aside className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">Предметы</div>
            <input
              className="mt-3 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
              placeholder="Поиск..."
            />
            <div className="mt-3 max-h-[560px] overflow-auto space-y-2">
              {filteredPalette.map((s) => (
                <PaletteDraggable key={s.id} id={paletteId(s.id)}>
                  <div className="w-full cursor-grab rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50 active:cursor-grabbing">
                    <div className="font-semibold">{s.code}</div>
                    <div className="text-xs text-zinc-600">{s.name}</div>
                  </div>
                </PaletteDraggable>
              ))}
            </div>
          </aside>

          <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="w-44 px-4 py-3 text-left text-xs font-semibold text-zinc-600">Пара</th>
                  {days.map((d) => (
                    <th key={d} className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">
                      {DOW[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeslots.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 align-top text-sm">
                      <div className="font-medium">№{t.number}</div>
                      <div className="text-xs text-zinc-500">
                        {t.startTime}–{t.endTime}
                      </div>
                    </td>
                    {days.map((d) => {
                      const cid = cellId(d, t.id);
                      const selected = d === selectedDay && t.id === selectedSlot;
                      const cellEntries = entriesByCell.get(cid) ?? [];
                      const highlighted = cellEntries.some((e) => conflictEntryIds.has(e.id));
                      const dropVariant = (() => {
                        if (!activeId) return null;
                        if (parseEntryId(activeId)) return cellEntries.length ? "swap" : "valid";
                        if (parsePaletteId(activeId)) return cellEntries.length ? "invalid" : "valid";
                        return null;
                      })();
                      return (
                        <td key={cid} className="px-3 py-3 align-top">
                          <DndCell
                            id={cid}
                            selected={selected}
                            highlighted={highlighted}
                            dropVariant={dropVariant}
                            onClick={() => onCellClick(d, t.id)}
                          >
                            {cellEntries.length ? (
                              <div className="space-y-2">
                                {cellEntries.map((e) => (
                                  <EntryDraggable key={e.id} id={entryDragId(e.id)}>
                                    <EntryCard
                                      entry={e}
                                      subjectById={subjectById}
                                      lessonTypeById={lessonTypeById}
                                      roomById={roomById}
                                      onClick={() => openEntry(e.id)}
                                    />
                                  </EntryDraggable>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-400">Пусто</div>
                            )}
                          </DndCell>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <aside className="rounded-2xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500">
                  {DOW[selectedDay] ?? "—"} · слот{" "}
                  {timeslots.find((t) => t.id === selectedSlot)?.number ?? "—"} · {selectedWeekType}
                </div>
                <div className="text-lg font-semibold">{selectedEntry ? "Детали" : "Выберите пару"}</div>
              </div>
            </div>
            <TrashZone activeId={activeId} />

            {selectedEntry ? (
              <div className="mt-4 space-y-4">
                <div className="flex gap-2">
                  {(["EVERY", "UPPER", "LOWER"] as WeekType[]).map((wt) => (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => updateSelected({ weekType: wt })}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        selectedEntry.weekType === wt ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                      ].join(" ")}
                    >
                      {wt}
                    </button>
                  ))}
                </div>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Предмет</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    value={selectedEntry.subjectId}
                    onChange={(e) => updateSelected({ subjectId: e.target.value })}
                  >
                    <option value="" disabled>
                      Выберите предмет
                    </option>
                    {(subjectsQ.data?.items ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  {(lessonTypesQ.data?.items ?? []).map((lt) => (
                    <button
                      key={lt.id}
                      type="button"
                      onClick={() => {
                        updateSelected({ lessonTypeId: lt.id });
                        const audience = autoAudienceForLessonType(lt.code);
                        if (audience) updateSelected({ audienceKind: audience.kind, audienceId: audience.id });
                      }}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        selectedEntry.lessonTypeId === lt.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                      ].join(" ")}
                    >
                      {lt.name}
                    </button>
                  ))}
                </div>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Преподаватель</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    value={selectedEntry.teacherId}
                    onChange={(e) => updateSelected({ teacherId: e.target.value })}
                  >
                    <option value="" disabled>
                      Выберите преподавателя
                    </option>
                    {(teacherAvailabilityQ.data ?? []).map((t) => (
                      <option key={t.teacher.id} value={t.teacher.id} disabled={!t.available}>
                        {t.available ? "✓" : "✗"} {t.teacher.user.lastName} {t.teacher.user.firstName}{" "}
                        {t.teachesSubject ? "· 📚" : ""} {t.busyWith ? `· ${t.busyWith}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Аудитория</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    value={selectedEntry.roomId}
                    onChange={(e) => updateSelected({ roomId: e.target.value })}
                  >
                    <option value="" disabled>
                      Выберите аудиторию
                    </option>
                    {(roomAvailabilityQ.data ?? []).map((r) => (
                      <option key={r.room.id} value={r.room.id} disabled={!r.available || !r.capacitySufficient || !r.typeOk}>
                        {r.available ? "✓" : "✗"} {r.room.name} · {r.room.capacity}
                        {r.room.hasComputers ? " · ПК" : ""}{" "}
                        {!r.capacitySufficient ? "· мало мест" : ""} {!r.typeOk ? "· не подходит" : ""} {r.busyWith ? `· ${r.busyWith}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Цель</span>
                  <select
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    value={selectedAudienceValue}
                    onChange={(e) => {
                      const next = splitAudience(e.target.value);
                      if (!next) return;
                      updateSelected({ audienceKind: next.kind, audienceId: next.id });
                    }}
                  >
                    {audienceOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-700">Комментарий</span>
                  <input
                    className="h-11 rounded-lg border border-zinc-200 bg-white px-3 outline-none focus:border-zinc-400"
                    value={selectedEntry.note}
                    onChange={(e) => updateSelected({ note: e.target.value })}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeEntry(selectedEntry.id)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Удалить (Delete)
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm text-zinc-600">Кликните по ячейке или создайте запись drag&drop.</div>
            )}

            <div className="mt-6">
              <div className="text-sm font-semibold">Конфликты</div>
              <div className="mt-2 space-y-2 text-sm">
                {conflicts.length ? (
                  conflicts.slice(0, 8).map((c, idx) => (
                    <div key={`${c.entryId}-${idx}`} className="rounded-lg border border-zinc-200 px-3 py-2">
                      <div className="text-xs text-zinc-500">{c.type}</div>
                      <div className="text-sm">{c.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-zinc-500">Конфликтов не найдено ✅</div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <DragOverlay>{activeDragOverlay}</DragOverlay>
      </DndContext>
    </div>
  );
}
