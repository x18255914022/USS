"use client";

import { create } from "zustand";

export type WeekType = "EVERY" | "UPPER" | "LOWER";
export type AudienceKind = "group" | "subgroup" | "stream";

export type EditorEntry = {
  id: string;
  semesterId: string;
  dayOfWeek: number;
  weekType: WeekType;
  timeslotId: string;
  subjectId: string;
  lessonTypeId: string;
  teacherId: string;
  roomId: string;
  note: string;
  audienceKind: AudienceKind;
  audienceId: string;
  _isNew?: boolean;
  _modified?: boolean;
  _moved?: boolean;
  _deleted?: boolean;
};

export type EditorConflict = {
  type: string;
  entryId: string;
  withEntryId?: string;
  message: string;
};

type EditorState = {
  entries: Record<string, EditorEntry>;
  snapshot: Record<string, EditorEntry>;
  selectedEntryId: string | null;
  selectedCell: { dayOfWeek: number; timeslotId: string } | null;
  conflicts: EditorConflict[];
  isSaving: boolean;

  loadEntries: (entries: EditorEntry[]) => void;
  selectCell: (cell: { dayOfWeek: number; timeslotId: string }) => void;
  selectEntry: (id: string | null) => void;
  upsertEntry: (entry: EditorEntry, opts?: { select?: boolean }) => void;
  moveEntry: (id: string, cell: { dayOfWeek: number; timeslotId: string }) => void;
  swapEntries: (aId: string, bId: string) => void;
  removeEntry: (id: string) => void;
  setConflicts: (conflicts: EditorConflict[]) => void;
  setSaving: (isSaving: boolean) => void;
  discardChanges: () => void;
  applyCreatedMap: (created: { clientId: string; id: string }[]) => void;
  markSaved: () => void;
};

function cloneEntry(e: EditorEntry): EditorEntry {
  return { ...e };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  entries: {},
  snapshot: {},
  selectedEntryId: null,
  selectedCell: null,
  conflicts: [],
  isSaving: false,

  loadEntries(entries) {
    const map: Record<string, EditorEntry> = {};
    for (const e of entries) map[e.id] = cloneEntry(e);
    set({ entries: map, snapshot: map, conflicts: [], selectedEntryId: null, selectedCell: null });
  },

  selectCell(cell) {
    set({ selectedCell: cell, selectedEntryId: null });
  },

  selectEntry(id) {
    set({ selectedEntryId: id, selectedCell: null });
  },

  upsertEntry(entry, opts) {
    set((s) => ({
      entries: { ...s.entries, [entry.id]: cloneEntry(entry) },
      ...(opts?.select ? { selectedEntryId: entry.id, selectedCell: null } : {})
    }));
  },

  moveEntry(id, cell) {
    set((s) => {
      const prev = s.entries[id];
      if (!prev) return s;
      const next: EditorEntry = {
        ...prev,
        dayOfWeek: cell.dayOfWeek,
        timeslotId: cell.timeslotId,
        _moved: true,
        _modified: prev._isNew ? prev._modified : true
      };
      return { entries: { ...s.entries, [id]: next } };
    });
  },

  swapEntries(aId, bId) {
    set((s) => {
      const a = s.entries[aId];
      const b = s.entries[bId];
      if (!a || !b) return s;
      const nextA: EditorEntry = { ...a, dayOfWeek: b.dayOfWeek, timeslotId: b.timeslotId, _moved: true, _modified: true };
      const nextB: EditorEntry = { ...b, dayOfWeek: a.dayOfWeek, timeslotId: a.timeslotId, _moved: true, _modified: true };
      return { entries: { ...s.entries, [aId]: nextA, [bId]: nextB } };
    });
  },

  removeEntry(id) {
    set((s) => {
      const prev = s.entries[id];
      if (!prev) return s;
      if (prev._isNew) {
        const next = { ...s.entries };
        delete next[id];
        return { entries: next, selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId };
      }
      return { entries: { ...s.entries, [id]: { ...prev, _deleted: true } } };
    });
  },

  setConflicts(conflicts) {
    set({ conflicts });
  },

  setSaving(isSaving) {
    set({ isSaving });
  },

  discardChanges() {
    const snap = get().snapshot;
    set({ entries: snap, conflicts: [], selectedEntryId: null, selectedCell: null });
  },

  applyCreatedMap(created) {
    set((s) => {
      if (!created.length) return s;
      const next: Record<string, EditorEntry> = { ...s.entries };
      for (const m of created) {
        const prev = next[m.clientId];
        if (!prev) continue;
        delete next[m.clientId];
        next[m.id] = { ...prev, id: m.id, _isNew: false, _modified: false, _moved: false };
      }
      return { entries: next };
    });
  },

  markSaved() {
    const clean: Record<string, EditorEntry> = {};
    for (const e of Object.values(get().entries)) {
      if (e._deleted) continue;
      clean[e.id] = { ...e, _isNew: false, _modified: false, _moved: false, _deleted: false };
    }
    set({ entries: clean, snapshot: clean, conflicts: [] });
  }
}));

