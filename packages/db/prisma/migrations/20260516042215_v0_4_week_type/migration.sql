-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lesson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "academicWeekId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "weekType" TEXT NOT NULL DEFAULT 'EVERY',
    "timeslotId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "lessonTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lesson_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_academicWeekId_fkey" FOREIGN KEY ("academicWeekId") REFERENCES "AcademicWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_timeslotId_fkey" FOREIGN KEY ("timeslotId") REFERENCES "Timeslot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lesson_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lesson_lessonTypeId_fkey" FOREIGN KEY ("lessonTypeId") REFERENCES "LessonType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lesson_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Lesson" ("academicWeekId", "createdAt", "dayOfWeek", "id", "lessonTypeId", "note", "roomId", "semesterId", "subjectId", "timeslotId", "updatedAt") SELECT "academicWeekId", "createdAt", "dayOfWeek", "id", "lessonTypeId", "note", "roomId", "semesterId", "subjectId", "timeslotId", "updatedAt" FROM "Lesson";
DROP TABLE "Lesson";
ALTER TABLE "new_Lesson" RENAME TO "Lesson";
CREATE INDEX "Lesson_semesterId_dayOfWeek_timeslotId_idx" ON "Lesson"("semesterId", "dayOfWeek", "timeslotId");
CREATE INDEX "Lesson_semesterId_dayOfWeek_weekType_idx" ON "Lesson"("semesterId", "dayOfWeek", "weekType");
CREATE INDEX "Lesson_academicWeekId_idx" ON "Lesson"("academicWeekId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
