-- CreateTable
CREATE TABLE "SemesterSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "minCancelHours" INTEGER,
    "autoApproveReplaceRoom" BOOLEAN,
    "updatedAt" DATETIME NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "SemesterSettings_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SemesterSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ScheduleChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "semesterId" TEXT NOT NULL,
    "lessonId" TEXT,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "comment" TEXT,
    "newDate" DATETIME,
    "newTeacherId" TEXT,
    "newRoomId" TEXT,
    "newDayOfWeek" INTEGER,
    "newTimeslotId" TEXT,
    "newSubjectId" TEXT,
    "newLessonTypeId" TEXT,
    "targetGroupId" TEXT,
    "targetSubgroupId" TEXT,
    "targetStreamGroupId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "rejectedById" TEXT,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduleChange_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_newTeacherId_fkey" FOREIGN KEY ("newTeacherId") REFERENCES "Teacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_newRoomId_fkey" FOREIGN KEY ("newRoomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_newTimeslotId_fkey" FOREIGN KEY ("newTimeslotId") REFERENCES "Timeslot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_newSubjectId_fkey" FOREIGN KEY ("newSubjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_newLessonTypeId_fkey" FOREIGN KEY ("newLessonTypeId") REFERENCES "LessonType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_targetSubgroupId_fkey" FOREIGN KEY ("targetSubgroupId") REFERENCES "Subgroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_targetStreamGroupId_fkey" FOREIGN KEY ("targetStreamGroupId") REFERENCES "StreamGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleChange_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ScheduleChange" ("approvedById", "comment", "createdAt", "createdById", "date", "id", "lessonId", "newDayOfWeek", "newRoomId", "newTeacherId", "newTimeslotId", "reason", "rejectedById", "revokedAt", "semesterId", "status", "type", "updatedAt") SELECT "approvedById", "comment", "createdAt", "createdById", "date", "id", "lessonId", "newDayOfWeek", "newRoomId", "newTeacherId", "newTimeslotId", "reason", "rejectedById", "revokedAt", "semesterId", "status", "type", "updatedAt" FROM "ScheduleChange";
DROP TABLE "ScheduleChange";
ALTER TABLE "new_ScheduleChange" RENAME TO "ScheduleChange";
CREATE INDEX "ScheduleChange_semesterId_date_status_idx" ON "ScheduleChange"("semesterId", "date", "status");
CREATE INDEX "ScheduleChange_createdById_status_idx" ON "ScheduleChange"("createdById", "status");
CREATE INDEX "ScheduleChange_lessonId_date_idx" ON "ScheduleChange"("lessonId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "SemesterSettings_semesterId_key" ON "SemesterSettings"("semesterId");
