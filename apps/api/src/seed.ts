import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import "./env.js";

type SeedRole = {
  code: string;
  name: string;
  permissionCodes: string[];
};

function envString(name: string, fallback: string) {
  const v = process.env[name];
  if (!v) return fallback;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : fallback;
}

async function seedPermissions(permissionCodes: string[]) {
  const permissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        create: { code, name: code },
        update: { name: code }
      })
    )
  );

  return new Map<string, any>(permissions.map((p) => [p.code, p] as const));
}

async function seedRoles(roles: SeedRole[]) {
  const created = await Promise.all(
    roles.map((r) =>
      prisma.role.upsert({
        where: { code: r.code },
        create: { code: r.code, name: r.name },
        update: { name: r.name }
      })
    )
  );

  return new Map<string, any>(created.map((r) => [r.code, r] as const));
}

async function seedRolePermissions(roles: SeedRole[], roleByCode: Map<string, any>, permByCode: Map<string, any>) {
  for (const role of roles) {
    const roleRow = roleByCode.get(role.code);
    if (!roleRow) throw new Error(`Role not found after upsert: ${role.code}`);

    const permIds = role.permissionCodes.map((c) => {
      const p = permByCode.get(c);
      if (!p) throw new Error(`Permission not found after upsert: ${c}`);
      return p.id as string;
    });

    await Promise.all(
      permIds.map((permissionId) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: roleRow.id as string, permissionId } },
          create: { roleId: roleRow.id as string, permissionId },
          update: {}
        })
      )
    );
  }
}

async function seedAdminUser(roleId: string) {
  const email = envString("SEED_ADMIN_EMAIL", "admin@example.com");
  const password = envString("SEED_ADMIN_PASSWORD", "admin12345");
  const firstName = envString("SEED_ADMIN_FIRST_NAME", "Admin");
  const lastName = envString("SEED_ADMIN_LAST_NAME", "User");
  const resetPassword = envString("SEED_ADMIN_RESET_PASSWORD", "0") === "1";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, firstName, lastName, isActive: true },
    update: {
      firstName,
      lastName,
      isActive: true,
      ...(resetPassword ? { passwordHash } : {})
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId } },
    create: { userId: user.id, roleId },
    update: {}
  });

  return user;
}

async function seedStudentUser(roleId: string, opts: { groupId: string; subgroupId?: string }) {
  const email = envString("SEED_STUDENT_EMAIL", "student@example.com");
  const password = envString("SEED_STUDENT_PASSWORD", "student12345");
  const firstName = envString("SEED_STUDENT_FIRST_NAME", "Student");
  const lastName = envString("SEED_STUDENT_LAST_NAME", "User");
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, firstName, lastName, isActive: true },
    update: { firstName, lastName, isActive: true }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId } },
    create: { userId: user.id, roleId },
    update: {}
  });

  const subgroupId = opts.subgroupId ?? null;
  if (subgroupId) {
    const subgroup = await prisma.subgroup.findUnique({ where: { id: subgroupId } });
    if (!subgroup || subgroup.groupId !== opts.groupId) throw new Error("Invalid seed subgroup");
  }

  await prisma.student.upsert({
    where: { userId: user.id },
    create: { userId: user.id, groupId: opts.groupId, subgroupId },
    update: { groupId: opts.groupId, subgroupId }
  });

  return user;
}

async function seedTeacherUser(
  roleId: string,
  opts: { departmentId: string; subjectIds: string[]; position?: string }
) {
  const email = envString("SEED_TEACHER_EMAIL", "teacher@example.com");
  const password = envString("SEED_TEACHER_PASSWORD", "teacher12345");
  const firstName = envString("SEED_TEACHER_FIRST_NAME", "Teacher");
  const lastName = envString("SEED_TEACHER_LAST_NAME", "User");
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, firstName, lastName, isActive: true },
    update: { firstName, lastName, isActive: true }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId } },
    create: { userId: user.id, roleId },
    update: {}
  });

  const teacher = await prisma.teacher.upsert({
    where: { userId: user.id },
    create: { userId: user.id, departmentId: opts.departmentId, position: opts.position },
    update: { departmentId: opts.departmentId, position: opts.position }
  });

  if (opts.subjectIds.length) {
    await Promise.all(
      opts.subjectIds.map((subjectId) =>
        prisma.teacherSubject.upsert({
          where: { teacherId_subjectId: { teacherId: teacher.id, subjectId } },
          create: { teacherId: teacher.id, subjectId },
          update: {}
        })
      )
    );
  }

  return user;
}

async function seedLessonTypes() {
  const data = [
    { code: "lecture", name: "Лекция", color: "#4f46e5" },
    { code: "practice", name: "Практика", color: "#22c55e" },
    { code: "lab", name: "Лабораторная", color: "#f97316" }
  ];

  await Promise.all(
    data.map((x) =>
      prisma.lessonType.upsert({
        where: { code: x.code },
        create: x,
        update: { name: x.name, color: x.color }
      })
    )
  );
}

async function seedRoomTypes() {
  const data = [
    { code: "classroom", name: "Аудитория" },
    { code: "lecture_hall", name: "Лекционная" },
    { code: "computer_lab", name: "Компьютерный класс" }
  ];

  const rows = await Promise.all(
    data.map((x) =>
      prisma.roomType.upsert({
        where: { code: x.code },
        create: x,
        update: { name: x.name }
      })
    )
  );

  return new Map<string, any>(rows.map((r) => [r.code, r] as const));
}

async function seedFacultiesDepartments() {
  const fit = await prisma.faculty.upsert({
    where: { code: "FIT" },
    create: { code: "FIT", name: "Факультет информационных технологий" },
    update: { name: "Факультет информационных технологий" }
  });

  const fen = await prisma.faculty.upsert({
    where: { code: "FEN" },
    create: { code: "FEN", name: "Факультет естественных наук" },
    update: { name: "Факультет естественных наук" }
  });

  await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fit.id, code: "SE" } },
    create: { facultyId: fit.id, code: "SE", name: "Кафедра программной инженерии" },
    update: { name: "Кафедра программной инженерии" }
  });

  await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fit.id, code: "AM" } },
    create: { facultyId: fit.id, code: "AM", name: "Кафедра прикладной математики" },
    update: { name: "Кафедра прикладной математики" }
  });

  await prisma.department.upsert({
    where: { facultyId_code: { facultyId: fen.id, code: "PHYS" } },
    create: { facultyId: fen.id, code: "PHYS", name: "Кафедра физики" },
    update: { name: "Кафедра физики" }
  });

  return { fit, fen };
}

async function seedBuildingsRooms(roomTypeByCode: Map<string, any>) {
  const mainBuilding = await prisma.building.upsert({
    where: { code: "MAIN" },
    create: { code: "MAIN", name: "Главный корпус", address: "ул. Университетская, 1" },
    update: { name: "Главный корпус", address: "ул. Университетская, 1" }
  });

  const labBuilding = await prisma.building.upsert({
    where: { code: "LAB" },
    create: { code: "LAB", name: "Лабораторный корпус", address: "ул. Научная, 10" },
    update: { name: "Лабораторный корпус", address: "ул. Научная, 10" }
  });

  const classroom = roomTypeByCode.get("classroom");
  const lectureHall = roomTypeByCode.get("lecture_hall");
  const computerLab = roomTypeByCode.get("computer_lab");
  if (!classroom || !lectureHall || !computerLab) throw new Error("Room types missing");

  const rooms = [
    {
      buildingId: mainBuilding.id as string,
      roomTypeId: lectureHall.id as string,
      name: "101",
      capacity: 120,
      floor: 1,
      hasProjector: true,
      hasComputers: false
    },
    {
      buildingId: mainBuilding.id as string,
      roomTypeId: classroom.id as string,
      name: "202",
      capacity: 35,
      floor: 2,
      hasProjector: true,
      hasComputers: false
    },
    {
      buildingId: labBuilding.id as string,
      roomTypeId: computerLab.id as string,
      name: "LAB-201",
      capacity: 28,
      floor: 2,
      hasProjector: true,
      hasComputers: true
    }
  ];

  await Promise.all(
    rooms.map((r) =>
      prisma.room.upsert({
        where: { buildingId_name: { buildingId: r.buildingId, name: r.name } },
        create: r,
        update: {
          roomTypeId: r.roomTypeId,
          capacity: r.capacity,
          floor: r.floor,
          hasProjector: r.hasProjector,
          hasComputers: r.hasComputers,
          isActive: true
        }
      })
    )
  );

  return { mainBuilding, labBuilding };
}

async function seedSubjects() {
  const data = [
    { code: "MATH101", name: "Математический анализ" },
    { code: "CS101", name: "Введение в программирование" },
    { code: "PHYS101", name: "Физика" }
  ];

  await Promise.all(
    data.map((x) =>
      prisma.subject.upsert({
        where: { code: x.code },
        create: x,
        update: { name: x.name }
      })
    )
  );
}

async function seedGroups(facultyId: string) {
  const groups = [
    { name: "ИВТ-21-1", course: 3, subgroupCount: 2 },
    { name: "ИВТ-21-2", course: 3, subgroupCount: 2 }
  ];

  const created = await Promise.all(
    groups.map((g) =>
      prisma.group.upsert({
        where: { name: g.name },
        create: { name: g.name, course: g.course, facultyId },
        update: { course: g.course, facultyId }
      })
    )
  );

  for (const g of created) {
    await Promise.all(
      [1, 2].map((number) =>
        prisma.subgroup.upsert({
          where: { groupId_number: { groupId: g.id, number } },
          create: { groupId: g.id, number },
          update: {}
        })
      )
    );
  }

  const subgroups = await prisma.subgroup.findMany({
    where: { groupId: { in: created.map((g) => g.id) } },
    orderBy: [{ groupId: "asc" }, { number: "asc" }]
  });

  return { groups: created, subgroups };
}

async function seedStreamGroup(name: string, groupIds: string[]) {
  const existing = await prisma.streamGroup.findFirst({ where: { name } });
  const streamGroup =
    existing ??
    (await prisma.streamGroup.create({
      data: { name }
    }));

  await Promise.all(
    groupIds.map((groupId) =>
      prisma.streamGroupEntry.upsert({
        where: { streamGroupId_groupId: { streamGroupId: streamGroup.id, groupId } },
        create: { streamGroupId: streamGroup.id, groupId },
        update: {}
      })
    )
  );

  await prisma.streamGroupEntry.deleteMany({
    where: { streamGroupId: streamGroup.id, groupId: { notIn: groupIds } }
  });

  return streamGroup;
}

function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

async function seedSemester(name: string, startDate: Date, endDate: Date) {
  const semester = await prisma.semester.upsert({
    where: { name },
    create: { name, startDate, endDate, isActive: true },
    update: { startDate, endDate, isActive: true }
  });

  await prisma.semester.updateMany({ where: { id: { not: semester.id } }, data: { isActive: false } });

  await Promise.all(
    Array.from({ length: 18 }, (_, i) => {
      const weekNumber = i + 1;
      const weekType = weekNumber % 2 === 1 ? "UPPER" : "LOWER";
      return prisma.academicWeek.upsert({
        where: { semesterId_weekNumber: { semesterId: semester.id, weekNumber } },
        create: {
          semesterId: semester.id,
          weekNumber,
          startDate: addDays(startDate, i * 7),
          weekType,
          isActive: true
        },
        update: { startDate: addDays(startDate, i * 7), weekType, isActive: true }
      });
    })
  );

  const timeslotSet = await prisma.timeslotSet.upsert({
    where: { semesterId_name: { semesterId: semester.id, name: "Основной" } },
    create: { semesterId: semester.id, name: "Основной", isDefault: true },
    update: { isDefault: true }
  });

  await prisma.timeslotSet.updateMany({ where: { semesterId: semester.id, id: { not: timeslotSet.id } }, data: { isDefault: false } });

  const timeslots = [
    { number: 1, startTime: "09:00", endTime: "10:30" },
    { number: 2, startTime: "10:40", endTime: "12:10" },
    { number: 3, startTime: "12:50", endTime: "14:20" },
    { number: 4, startTime: "14:30", endTime: "16:00" },
    { number: 5, startTime: "16:10", endTime: "17:40" },
    { number: 6, startTime: "17:50", endTime: "19:20" }
  ];

  await Promise.all(
    timeslots.map((t) =>
      prisma.timeslot.upsert({
        where: { timeslotSetId_number: { timeslotSetId: timeslotSet.id, number: t.number } },
        create: { timeslotSetId: timeslotSet.id, number: t.number, startTime: t.startTime, endTime: t.endTime },
        update: { startTime: t.startTime, endTime: t.endTime }
      })
    )
  );

  return semester;
}

async function main() {
  const prefixes = [
    "faculties",
    "departments",
    "buildings",
    "room_types",
    "rooms",
    "subjects",
    "lesson_types",
    "groups",
    "stream_groups",
    "users",
    "teachers",
    "semesters",
    "academic_weeks",
    "timeslot_sets",
    "lessons",
    "schedule",
    "changes",
    "settings",
    "notifications",
    "queues"
  ];

  const permissionCodes = prefixes.flatMap((p) => [`${p}:read`, `${p}:write`]);

  const roles: SeedRole[] = [
    { code: "admin", name: "Администратор", permissionCodes },
    { code: "manager", name: "Менеджер", permissionCodes },
    { code: "teacher", name: "Преподаватель", permissionCodes: ["lessons:read", "schedule:read", "changes:read", "changes:write"] },
    { code: "student", name: "Студент", permissionCodes: ["lessons:read", "schedule:read", "changes:read"] }
  ];

  const permByCode = await seedPermissions(permissionCodes);
  const roleByCode = await seedRoles(roles);
  await seedRolePermissions(roles, roleByCode, permByCode);

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", minCancelHours: 2, autoApproveReplaceRoom: true },
    update: {}
  });

  const adminRole = roleByCode.get("admin");
  if (!adminRole) throw new Error("Admin role missing");

  const teacherRole = roleByCode.get("teacher");
  if (!teacherRole) throw new Error("Teacher role missing");

  const studentRole = roleByCode.get("student");
  if (!studentRole) throw new Error("Student role missing");

  await seedAdminUser(adminRole.id as string);
  await seedLessonTypes();
  const roomTypeByCode = await seedRoomTypes();
  const { fit } = await seedFacultiesDepartments();
  await seedBuildingsRooms(roomTypeByCode);
  await seedSubjects();

  const { groups, subgroups } = await seedGroups(fit.id as string);
  await seedStreamGroup("ИВТ-21", groups.map((g) => g.id as string));
  const semester = await seedSemester("Весна 2026", new Date("2026-02-01"), new Date("2026-06-30"));

  const studentSubgroup = subgroups.find((s) => s.groupId === groups[0]?.id && s.number === 1);
  await seedStudentUser(studentRole.id as string, { groupId: groups[0]!.id as string, subgroupId: studentSubgroup?.id });

  const seDept = await prisma.department.findFirst({ where: { facultyId: fit.id, code: "SE" } });
  if (!seDept) throw new Error("SE department missing");

  const teacherSubjects = await prisma.subject.findMany({ orderBy: { code: "asc" }, take: 2 });
  const teacherUser = await seedTeacherUser(teacherRole.id as string, {
    departmentId: seDept.id,
    subjectIds: teacherSubjects.map((s) => s.id),
    position: "Доцент"
  });

  const existingLessons = await prisma.lesson.count();
  if (existingLessons < 10) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUser.id } });
    if (!teacher) throw new Error("Seed teacher missing");

    const lessonType = await prisma.lessonType.findFirst({ where: { code: "lecture" } });
    if (!lessonType) throw new Error("Seed lesson type missing");

    const room = await prisma.room.findFirst({ orderBy: { name: "asc" } });
    if (!room) throw new Error("Seed room missing");

    const defaultSet = await prisma.timeslotSet.findFirst({
      where: { semesterId: semester.id, isDefault: true },
      include: { timeslots: { orderBy: { number: "asc" } } }
    });
    const timeslotsList = defaultSet?.timeslots ?? [];
    if (timeslotsList.length < 4) throw new Error("Seed timeslots missing");

    const subject = teacherSubjects[0];
    if (!subject) throw new Error("Seed subject missing");

    const lab = await prisma.lessonType.findFirst({ where: { code: "lab" } });
    const practice = await prisma.lessonType.findFirst({ where: { code: "practice" } });
    const lessonTypes = [lessonType, practice, lab].filter(Boolean) as any[];

    const subgroup1 = studentSubgroup?.id;
    const subgroup2 = subgroups.find((s) => s.groupId === groups[0]?.id && s.number === 2)?.id;
    const streamGroup = await prisma.streamGroup.findFirst({ include: { entries: true } });

    const plan = [
      { dayOfWeek: 1, slot: 1, weekType: "EVERY", audience: { groupId: groups[0]!.id as string } },
      { dayOfWeek: 1, slot: 2, weekType: "UPPER", audience: subgroup1 ? { subgroupId: subgroup1 } : { groupId: groups[0]!.id as string } },
      { dayOfWeek: 1, slot: 2, weekType: "LOWER", audience: subgroup2 ? { subgroupId: subgroup2 } : { groupId: groups[0]!.id as string } },
      {
        dayOfWeek: 2,
        slot: 1,
        weekType: "EVERY",
        audience: streamGroup ? { streamGroupId: streamGroup.id } : { groupId: groups[0]!.id as string }
      },
      { dayOfWeek: 3, slot: 3, weekType: "UPPER", audience: { groupId: groups[0]!.id as string } },
      { dayOfWeek: 4, slot: 4, weekType: "LOWER", audience: { groupId: groups[0]!.id as string } },
      { dayOfWeek: 5, slot: 2, weekType: "EVERY", audience: { groupId: groups[1]!.id as string } }
    ];

    for (const p of plan) {
      const slot = timeslotsList.find((t) => t.number === p.slot);
      if (!slot) continue;
      const lt = lessonTypes[(p.dayOfWeek + p.slot) % lessonTypes.length];
      const subj = teacherSubjects[(p.dayOfWeek + p.slot) % teacherSubjects.length] ?? subject;

      await prisma.lesson.create({
        data: {
          semesterId: semester.id,
          academicWeekId: null,
          dayOfWeek: p.dayOfWeek,
          weekType: p.weekType,
          timeslotId: slot.id,
          subjectId: subj.id,
          lessonTypeId: lt.id,
          roomId: room.id,
          note: "Демо расписание",
          teachers: { create: [{ teacherId: teacher.id }] },
          ...(p.audience as any).groupId ? { groups: { create: [{ groupId: (p.audience as any).groupId }] } } : {},
          ...(p.audience as any).subgroupId
            ? { subgroups: { create: [{ subgroupId: (p.audience as any).subgroupId }] } }
            : {},
          ...(p.audience as any).streamGroupId
            ? { streamGroups: { create: [{ streamGroupId: (p.audience as any).streamGroupId }] } }
            : {}
        }
      });
    }
  }

  const [
    users,
    rolesCount,
    permsCount,
    faculties,
    departments,
    buildings,
    rooms,
    subjects,
    lessonTypes,
    roomTypes,
    groupsCount,
    subgroupsCount,
    streamGroupsCount,
    studentsCount,
    teachersCount,
    semestersCount,
    academicWeeksCount,
    timeslotSetsCount,
    timeslotsCount,
    lessonsCount
  ] =
    await prisma.$transaction([
      prisma.user.count(),
      prisma.role.count(),
      prisma.permission.count(),
      prisma.faculty.count(),
      prisma.department.count(),
      prisma.building.count(),
      prisma.room.count(),
      prisma.subject.count(),
      prisma.lessonType.count(),
      prisma.roomType.count(),
      prisma.group.count(),
      prisma.subgroup.count(),
      prisma.streamGroup.count(),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.semester.count(),
      prisma.academicWeek.count(),
      prisma.timeslotSet.count(),
      prisma.timeslot.count(),
      prisma.lesson.count()
    ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        counts: {
          users,
          roles: rolesCount,
          permissions: permsCount,
          faculties,
          departments,
          buildings,
          rooms,
          subjects,
          lessonTypes,
          roomTypes,
          groups: groupsCount,
          subgroups: subgroupsCount,
          streamGroups: streamGroupsCount,
          students: studentsCount,
          teachers: teachersCount,
          semesters: semestersCount,
          academicWeeks: academicWeeksCount,
          timeslotSets: timeslotSetsCount,
          timeslots: timeslotsCount,
          lessons: lessonsCount
        }
      },
      null,
      2
    )
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
