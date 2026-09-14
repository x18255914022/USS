export type FieldType = "text" | "number" | "boolean" | "color" | "select" | "date";

export type SelectSource = {
  resource: string;
  label: (item: any) => string;
};

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  selectSource?: SelectSource;
};

export type ResourceDef = {
  resource: string;
  title: string;
  fields: FieldDef[];
  listColumns: { key: string; label: string }[];
};

export const ADMIN_RESOURCES: Record<string, ResourceDef> = {
  faculties: {
    resource: "faculties",
    title: "Факультеты",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" }
    ]
  },
  departments: {
    resource: "departments",
    title: "Кафедры",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true },
      {
        name: "facultyId",
        label: "Факультет",
        type: "select",
        required: true,
        selectSource: { resource: "faculties", label: (x) => `${x.code} — ${x.name}` }
      }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" },
      { key: "facultyId", label: "facultyId" }
    ]
  },
  buildings: {
    resource: "buildings",
    title: "Корпуса",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true },
      { name: "address", label: "Адрес", type: "text", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" },
      { key: "address", label: "Адрес" }
    ]
  },
  "room-types": {
    resource: "room-types",
    title: "Типы аудиторий",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" }
    ]
  },
  rooms: {
    resource: "rooms",
    title: "Аудитории",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      {
        name: "buildingId",
        label: "Корпус",
        type: "select",
        required: true,
        selectSource: { resource: "buildings", label: (x) => `${x.code} — ${x.name}` }
      },
      {
        name: "roomTypeId",
        label: "Тип",
        type: "select",
        required: true,
        selectSource: { resource: "room-types", label: (x) => `${x.code} — ${x.name}` }
      },
      { name: "capacity", label: "Вместимость", type: "number", required: true },
      { name: "floor", label: "Этаж", type: "number" },
      { name: "hasProjector", label: "Проектор", type: "boolean" },
      { name: "hasComputers", label: "Компьютеры", type: "boolean" },
      { name: "isActive", label: "Активна", type: "boolean" }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "capacity", label: "Вместимость" },
      { key: "isActive", label: "Активна" }
    ]
  },
  subjects: {
    resource: "subjects",
    title: "Предметы",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" }
    ]
  },
  "lesson-types": {
    resource: "lesson-types",
    title: "Типы занятий",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "code", label: "Код", type: "text", required: true },
      { name: "color", label: "Цвет", type: "color", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "code", label: "Код" },
      { key: "color", label: "Цвет" }
    ]
  },
  groups: {
    resource: "groups",
    title: "Группы",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "course", label: "Курс", type: "number", required: true },
      {
        name: "facultyId",
        label: "Факультет",
        type: "select",
        required: true,
        selectSource: { resource: "faculties", label: (x) => `${x.code} — ${x.name}` }
      },
      { name: "subgroupCount", label: "Подгруппы", type: "number", required: true }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "course", label: "Курс" },
      { key: "facultyId", label: "facultyId" }
    ]
  },
  semesters: {
    resource: "semesters",
    title: "Семестры",
    fields: [
      { name: "name", label: "Название", type: "text", required: true },
      { name: "startDate", label: "Начало", type: "date", required: true },
      { name: "endDate", label: "Конец", type: "date", required: true },
      { name: "isActive", label: "Активный", type: "boolean" }
    ],
    listColumns: [
      { key: "name", label: "Название" },
      { key: "startDate", label: "Начало" },
      { key: "endDate", label: "Конец" },
      { key: "isActive", label: "Активный" }
    ]
  }
};
