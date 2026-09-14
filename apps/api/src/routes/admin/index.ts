import type { FastifyInstance } from "fastify";
import { buildingsRoutes } from "./buildings.js";
import { departmentsRoutes } from "./departments.js";
import { facultiesRoutes } from "./faculties.js";
import { groupsRoutes } from "./groups.js";
import { lessonTypesRoutes } from "./lesson-types.js";
import { lessonsRoutes } from "./lessons.js";
import { roomTypesRoutes } from "./room-types.js";
import { roomsRoutes } from "./rooms.js";
import { semestersRoutes } from "./semesters.js";
import { streamGroupsRoutes } from "./stream-groups.js";
import { subjectsRoutes } from "./subjects.js";
import { teachersRoutes } from "./teachers.js";
import { usersRoutes } from "./users.js";
import { settingsRoutes } from "./settings.js";
import { notificationsRoutes } from "./notifications.js";

export async function adminRoutes(app: FastifyInstance) {
  app.register(facultiesRoutes, { prefix: "/faculties" });
  app.register(departmentsRoutes, { prefix: "/departments" });
  app.register(buildingsRoutes, { prefix: "/buildings" });
  app.register(roomTypesRoutes, { prefix: "/room-types" });
  app.register(roomsRoutes, { prefix: "/rooms" });
  app.register(subjectsRoutes, { prefix: "/subjects" });
  app.register(lessonTypesRoutes, { prefix: "/lesson-types" });
  app.register(groupsRoutes, { prefix: "/groups" });
  app.register(streamGroupsRoutes, { prefix: "/stream-groups" });
  app.register(teachersRoutes, { prefix: "/teachers" });
  app.register(semestersRoutes, { prefix: "/semesters" });
  app.register(lessonsRoutes, { prefix: "/lessons" });
  app.register(usersRoutes, { prefix: "/admin/users" });
  app.register(settingsRoutes, { prefix: "/admin/settings" });
  app.register(notificationsRoutes, { prefix: "/admin/notifications" });
}
