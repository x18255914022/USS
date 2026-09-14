// Common API types
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Admin resources
export type AdminResourceItem = Record<string, string | number | boolean | null | undefined>;

// Schedule types
export interface Timeslot {
  id: string;
  number: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleItem {
  id: string;
  dayOfWeek: number;
  weekType: string;
  timeslotId: string;
  timeslot: Timeslot;
  subject: {
    code: string;
    name: string;
  };
  lessonType: {
    code: string;
    name: string;
    color: string;
  };
  room: { name: string } | null;
  teachers: {
    teacher: {
      user: {
        firstName: string;
        lastName: string;
      };
    };
  }[];
  cancelled?: boolean;
  roomOverride?: { name: string } | null;
  rescheduledTo?: string | null;
  movedFrom?: string | null;
  isExtra?: boolean;
}

export interface ScheduleData {
  kind: "student" | "teacher" | "none";
  weekType: string | null;
  week: { weekNumber: number; startDate: string; weekType: string } | null;
  timeslots: Timeslot[];
  items: ScheduleItem[];
}

export interface RoomScheduleData {
  weekType: string | null;
  week: { weekNumber: number; startDate: string; weekType: string } | null;
  timeslots: Timeslot[];
  room: { id: string; name: string };
  items: ScheduleItem[];
}

// Select options
export interface Option {
  value: string;
  label: string;
}

// Manager types
export interface SemesterItem {
  id: string;
  name: string;
  isActive: boolean;
}

export interface GroupItem {
  id: string;
  name: string;
}

export interface StreamGroupItem {
  id: string;
  name: string;
}

export interface SubjectItem {
  id: string;
  name: string;
  code: string;
}

export interface LessonTypeItem {
  id: string;
  name: string;
  code: string;
  color: string;
}

export interface RoomItem {
  id: string;
  name: string;
}

export interface TeacherItem {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Admin types
export interface FacultyItem {
  id: string;
  name: string;
  code: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
  facultyId: string;
}

export interface BuildingItem {
  id: string;
  name: string;
  code: string;
  address: string;
}

export interface RoomTypeItem {
  id: string;
  name: string;
  code: string;
}

export interface LessonItem {
  id: string;
  semesterId: string;
  academicWeekId: string | null;
  dayOfWeek: number;
  note: string | null;
  timeslot: {
    id: string;
    number: number;
    startTime: string;
    endTime: string;
    timeslotSet: { name: string; isDefault: boolean };
  };
  subject: { id: string; name: string; code: string };
  lessonType: { id: string; name: string; code: string; color: string };
  room: { id: string; name: string } | null;
  teachers: { teacher: { id: string; user: { firstName: string; lastName: string } } }[];
  groups: { group: { id: string; name: string } }[];
  streamGroups: { streamGroup: { id: string; name: string } }[];
}

// User types
export interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
}

// Week types
export interface WeekItem {
  id: string;
  weekNumber: number;
  startDate: string;
  weekType: string;
  isActive: boolean;
}
