# ROADMAP: University Schedule System

Ты — senior full-stack разработчик. Ниже — пошаговый roadmap системы расписания вуза. Каждая версия — самодостаточный инкремент, который можно задеплоить и показать. Каждая следующая версия надстраивается над предыдущей, не ломая существующее.

## Статус реализации (обновлено: 2026-10-05)

- ✅ **v0.1 – v0.8 — реализованы полностью.**
- ✅ **v0.9 — реализован полностью (2026-10-05):** добавлены E2E-тесты (Playwright, `pnpm test:e2e`: логин → создание занятия → отмена → студент видит отмену) и UX-полировка (error boundary, skeleton-загрузка, пустые состояния, responsive, фикс потери правок в редакторе).
- 🔶 **v1.0 — реализован частично (2026-10-05):** сделаны миграция на PostgreSQL, `docker-compose.prod.yml` (Caddy-прокси, мульти-стейдж образы, бот в стеке, идемпотентный авто-сид), Swagger (`/docs`), прод-документация. НЕ сделаны: прогон с реальным доменом/TLS, оптимизация размера образов, rate limiting (требует апгрейда на Fastify 5).
- ⚠️ Отклонения от плана: rate limiting в API отключён (apps/api/src/server.ts, до апгрейда на Fastify 5); каналы WebPush/Email НЕ реализованы (уведомления только Telegram); сессии бота in-memory; прод-образы ~1.1GB без prune (pnpm prune не работает в workspace — см. DEPLOYMENT.md).

---

## Как читать этот roadmap

- Каждая версия должна быть реализована как рабочий, демонстрируемый инкремент.
- На каждом шаге сначала делаем минимальный работающий MVP, потом добавляем улучшения.
- Версия включает backend, frontend, seed и definition of done.
- Следующая версия опирается на предыдущую, поэтому не усложняем scope преждевременно.

---

## Стек (общий для всех версий)

- **Runtime:** Node.js
- **API:** Fastify (порт 3001)
- **ORM:** Prisma
- **Frontend:** Next.js App Router (порт 3000)
- **Validation:** Zod (schemas в packages/shared)
- **DB:** SQLite (миграция на PostgreSQL перенесена в v1.0)
- **Монорепо:** Turborepo

### Базовые env

- `DATABASE_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `NEXTAUTH_URL` / `APP_URL`
- `TELEGRAM_BOT_TOKEN` (v0.6+)
- `REDIS_URL` (v0.7+)
- `SMTP_URL` / `EMAIL_*` (v0.8+ добавочные каналы) (отложено, не реализовано)

Добавляется по мере необходимости:
- **v0.5+:** Zustand, dnd-kit
- **v0.6+:** grammyJS
- **v0.7+:** BullMQ, Redis
- **v0.8+:** PostgreSQL, Supabase (отложено, не реализовано)

---

## Структура монорепо (закладывается в v0.1, растёт)

```
university-schedule/
├── apps/
│   ├── api/          # v0.1+
│   ├── web/          # v0.1+
│   ├── bot/          # v0.6+
│   └── worker/       # v0.7+
├── packages/
│   ├── db/           # v0.1+ (Prisma)
│   └── shared/       # v0.1+ (Zod, типы)
├── turbo.json
├── docker-compose.yml
└── .env.example
```

---

## Итерационный формат

Для каждой версии описан:
- Prisma: необходимые модели, ограничения и миграции
- API: новые эндпоинты и бизнес-правила
- Frontend: страницы, UX и guard-ы
- Seed: демо-данные для проверки сценариев
- Definition of Done: конкретные проверяемые результаты

---

## ✅ v0.1 — Скелет и справочники

> **Цель:** рабочий монорепо, авторизация, CRUD справочников. Можно залогиниться и создать факультет, группу, аудиторию.

### Prisma-схема (только то, что нужно в этой версии)

```
User (id, email, passwordHash, firstName, lastName, isActive, createdAt, updatedAt)
Role (id, name, code)
Permission (id, code, name)
UserRole, RolePermission

Faculty (id, name, code)
Department (id, name, code, facultyId)
Building (id, name, code, address)
RoomType (id, name, code)
Room (id, name, buildingId, roomTypeId, capacity, floor, hasProjector, hasComputers, isActive)
Subject (id, name, code)
LessonType (id, name, code, color)
```

НЕ включать пока: Group, Student, Teacher, Semester, Schedule, Changes, Notifications.

### API (apps/api)

- Fastify bootstrap: cors, jwt, cookie, global error handler, health check
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me`
- JWT: access 15min + refresh 7d, bcryptjs
- RBAC middleware: `fastify.authenticate`, `fastify.authorize(permissions[])`
- CRUD endpoints для КАЖДОГО справочника:
  - `GET /api/{entity}` (list, pagination, search)
  - `POST /api/{entity}` (create)
  - `PATCH /api/{entity}/:id` (update)
  - `DELETE /api/{entity}/:id` (soft delete где нужно)
- Zod-валидация на все входные данные, схемы в `packages/shared`

### Frontend (apps/web)

- Next.js scaffold, Tailwind, shadcn/ui
- API client (fetch wrapper с auto-attach JWT, auto-refresh)
- Auth: login page, register page, useAuth hook, redirect
- Dashboard layout: sidebar (navigation по ролям), header
- RBAC guard (скрывать маршруты и пункты меню)
- Для КАЖДОГО справочника: страница с DataTable (TanStack Table, server-side pagination, search, фильтры) + модалка create/edit (React Hook Form + Zod)
- Страницы: `/admin/rooms`, `/admin/subjects`, `/admin/buildings`, `/admin/lesson-types`, `/admin/faculties`

### Seed

- 4 роли (admin, manager, teacher, student) + permissions
- Admin user
- 7 lesson types с цветами
- 5 room types
- Demo: 1 факультет, 1 кафедра, 1 корпус, 5 аудиторий, 6 предметов

### Definition of Done v0.1
- [x] `turbo run build` без ошибок
- [x] Логин → dashboard → CRUD аудиторий (создать, изменить, удалить, поиск)
- [x] Все справочники работают через UI
- [x] RBAC: student не видит `/admin/*`

---

## ✅ v0.2 — Группы, преподаватели, семестры

> **Цель:** добавить всё, что нужно ДО расписания. Группы с подгруппами, потоки, преподаватели, семестры, академические недели, расписание звонков.

### Prisma — добавить модели

```
Group (id, name, course, facultyId)
Subgroup (id, number, groupId) @@unique([groupId, number])
StreamGroup (id, name)
StreamGroupEntry (streamGroupId, groupId) @@id([streamGroupId, groupId])

Student (id, userId, groupId, subgroupId?)
Teacher (id, userId, departmentId, position?)
TeacherSubject (teacherId, subjectId)

Semester (id, name, startDate, endDate, isActive)
AcademicWeek (id, semesterId, weekNumber, startDate, weekType, isActive)
  enum WeekType { EVERY, UPPER, LOWER }
TimeslotSet (id, name, semesterId, isDefault)
Timeslot (id, timeslotSetId, number, startTime, endTime)
```

### API — новые endpoints

- Groups CRUD: `POST /api/groups` — создание + автогенерация подгрупп (по count). `GET /api/groups/:id` — с подгруппами и count студентов.
- Stream Groups CRUD: `POST /api/stream-groups { name, groupIds }`, `PATCH .../groups` — добавить/убрать.
- Users CRUD: `GET/POST/PATCH /api/admin/users`. При назначении роли student → создать Student (groupId обязателен). При teacher → создать Teacher (departmentId обязателен).
- Teachers: `GET /api/teachers` (с department, subjects), привязка предметов.
- Semesters CRUD: `POST /api/semesters` → автогенерация 18 AcademicWeeks (чередование UPPER/LOWER).
- Academic Weeks: `GET /api/semesters/:id/weeks`, `PATCH /api/semesters/:id/weeks` (bulk update weekType/isActive).
- Timeslot Sets: `POST /api/semesters/:id/timeslot-sets { name, timeslots[] }`.

### Frontend — новые страницы

- `/admin/groups` — DataTable + modal (с выбором faculty, course, subgroupCount). Expandable row → подгруппы.
- `/admin/groups/streams` — потоки: name + multi-select групп.
- `/admin/users` — DataTable + modal. Назначение ролей, при student → выбор группы.
- `/admin/teachers` — DataTable с привязкой предметов (multi-select).
- `/admin/semesters` — DataTable. Кнопка "Активировать".
- `/manager/weeks` — разметка недель семестра: таблица weekNumber/dates/weekType(toggle)/isActive(checkbox). Кнопка "Автозаполнить чередование". Кнопка "Сохранить" (bulk PATCH).
- Profile page: `/profile` — изменение имени, email, пароль.

### Seed — расширить

- 2 группы (ИВТ-21-1, ИВТ-21-2) с подгруппами
- 1 поток
- Семестр "Весна 2026" + 18 недель + расписание звонков (6 пар)

### Definition of Done v0.2
- [x] Создать группу с 2 подгруппами → видно в таблице
- [x] Создать поток из 2 групп
- [x] Создать семестр → недели автосгенерированы → можно переразметить
- [x] Создать пользователя-студента → привязан к группе

---

## ✅ v0.3 — Просмотр расписания (read-only)

> **Цель:** расписание можно увидеть. Пока только ручное заполнение через API/seed — без редактора.

### Prisma — добавить ScheduleEntry

```
ScheduleEntry (id, groupId?, subgroupId?, streamGroupId?,
  subjectId, lessonTypeId, teacherId, roomId,
  dayOfWeek, weekType, timeslotId, semesterId,
  createdAt, updatedAt)

@@index([semesterId, dayOfWeek, weekType])
@@index([teacherId, semesterId])
@@index([roomId, semesterId])
@@index([groupId, semesterId])
```

XOR-constraint (groupId | subgroupId | streamGroupId) — валидация в сервисе.

### API

- `POST /api/schedule/entries` — создание записи. Zod-валидация XOR-target.
- `GET /api/schedule/entries?semesterId=X&groupId=Y` — все entries группы в семестре.
- `GET /api/schedule/group/:groupId?date=ISO` — **расписание на неделю** с учётом weekType. Алгоритм:
  1. Определить AcademicWeek по date
  2. Выбрать entries WHERE weekType IN [week.weekType, 'EVERY']
  3. Фильтр: groupId | subgroup.groupId | streamGroup содержит group
  4. Include: subject, teacher, room, timeslot, lessonType
  5. Сортировка: dayOfWeek → timeslot.number
- `GET /api/schedule/teacher/:teacherId?date=ISO` — аналогично для преподавателя.
- `GET /api/schedule/me?date=ISO` — для авторизованного студента (по его group + subgroup + streams).

### Frontend

- `/schedule` — **главная страница** после логина для всех ролей.
  - Toolbar: group selector, week navigator (◀ Неделя 3 (верхняя) ▶), view toggle (День | Неделя).
  - **WeekView:** CSS Grid (6 дней × N слотов). Левая колонка: номер пары + время. Ячейки: subject, teacher, room, цветовая метка lessonType.color. Badge подгруппы, потока. Подсветка сегодняшнего дня.
  - **DayView:** вертикальный список карточек. Основной режим на мобильных. Swipe-навигация по дням.
  - Авто-переключение: mobile → DayView, desktop → WeekView.
- useSchedule hook (TanStack Query, staleTime 5min).
- useCurrentWeek hook (загрузить все недели семестра, навигация локально).
- `/schedule/teacher/[teacherId]` — расписание преподавателя.

### Seed — добавить demo-расписание

- 10–15 записей ScheduleEntry для ИВТ-21-1 (mix: группа, подгруппы, поток; EVERY/UPPER/LOWER).

### Definition of Done v0.3
- [x] Студент логинится → видит сетку расписания своей группы
- [x] Навигация по неделям: верхняя/нижняя показывают разные пары
- [x] Мобильный: DayView с карточками
- [x] Расписание преподавателя работает

---

## ✅ v0.4 — Редактор расписания (базовый)

> **Цель:** менеджер может составлять расписание через UI. Без drag & drop — форма в ячейке сетки. С проверкой конфликтов.

### API

- **ConflictService.check(entry, excludeId?):**
  - Преподаватель не на 2 парах
  - Аудитория не занята
  - Группа не на 2 парах
  - Вместимость аудитории ≥ audience size
  - Тип аудитории (lab → hasComputers)
  - weekType EVERY конфликтует с UPPER/LOWER: `conflictWeekTypes(wt) = wt === 'EVERY' ? ['EVERY','UPPER','LOWER'] : ['EVERY', wt]`
- Обновить `POST /api/schedule/entries` — вызывать ConflictService перед сохранением. Конфликт → 409 + `{ conflicts: [...] }`.
- `PATCH /api/schedule/entries/:id` — update с проверкой.
- `DELETE /api/schedule/entries/:id`.
- `GET /api/schedule/conflicts?semesterId&groupId` — все конфликты группы.

### Frontend

- `/manager/editor` — **Редактор расписания (v1):**
  - Toolbar: semester select, group select, weekType toggle (UPPER | LOWER | обе).
  - Сетка: дни × слоты. Пустые ячейки — кликабельные. Заполненные — кликабельные для редактирования.
  - **Клик по ячейке → модалка / боковая панель:**
    - Select: предмет, тип занятия, преподаватель, аудитория, цель (группа/подгруппа/поток), weekType.
    - Обычные `<select>` (без smart-селекторов — они в v0.5).
    - Submit → POST/PATCH → если конфликт → показать ошибки в форме.
    - Delete button.
  - Отображение конфликтов: красная рамка на ячейке, список внизу сетки.
- `/manager/conflicts` — обзор конфликтов: таблица с описаниями, клик → redirect на editor.

> Примечание: сначала реализовать простой редактор без drag & drop и без сложных smart-селекторов. Это поможет удержать scope и обеспечить стабильный рабочий релиз v0.4.

### Definition of Done v0.4
- [x] Менеджер: клик по пустой ячейке → заполнить форму → сохранить → пара появилась
- [x] Конфликт (тот же преподаватель) → ошибка в форме
- [x] Удаление пары
- [x] Студент видит изменения в расписании

---

## ✅ v0.5 — Редактор: Drag & Drop + умные селекторы

> **Цель:** полноценный визуальный редактор. Drag & Drop, batch-сохранение, smart-селекторы преподавателей и аудиторий.

### API — новые endpoints

- `POST /api/schedule/entries/batch` — атомарный batch. Массив операций `{ type: create|update|delete }`. Проверить ВСЕ на конфликты → если хоть один конфликт → 409, ничего не сохраняется. Если чисто → Prisma $transaction.
- `GET /api/teachers/availability?dayOfWeek&timeslotId&semesterId&weekType&subjectId?` — список преподавателей + `available: boolean`, `busyWith: string?`, `teachesSubject: boolean?`. Сортировка: available+teachesSubject first.
- `GET /api/rooms/availability?dayOfWeek&timeslotId&semesterId&weekType&minCapacity?&lessonTypeCode?` — список аудиторий + `available`, `busyWith`, `capacitySufficient`. Фильтры: minCapacity, hasComputers, buildingId.

> Примечание: этот этап закладывает UX редактора полного цикла. Если не успевает, оставьте v0.5 как минимум для drag/drop и smart-селектов после отлаженного сохранения batch.

### Frontend — переписать editor

- **Zustand store (useEditorStore):**
  - State: entries Map<cellKey, Entry>, selectedCellKey, conflicts, isDirty, isSaving.
  - cellKey = `${dayOfWeek}-${slotNumber}-${weekType}`.
  - Actions: loadEntries, placeEntry, moveEntry, removeEntry, updateEntry, selectCell, saveAll, discardChanges.
  - Tracking flags: `_isNew`, `_modified`, `_moved`, `_deleted`.

- **Drag & Drop (dnd-kit):**
  - EditorDndContext: DndContext + DragOverlay + sensors (Pointer 8px, Touch 200ms, Keyboard).
  - SubjectPalette (left): draggable предметы. Поиск, группировка по кафедре.
  - EditorCell: useDraggable (если есть entry) + useDroppable (всегда). Drop states: valid (голубой), invalid (красный), swap (жёлтый).
  - Drag palette → empty cell → создать entry, открыть DetailPanel.
  - Drag entry → empty cell → переместить.
  - Drag entry → occupied cell → swap.
  - TrashZone: появляется внизу при drag entry. Drop → удалить.
  - DragOverlayContent: призрак при перетаскивании (shadow, rotate 2deg).

- **EntryDetailPanel (right sidebar):**
  - Header: день + номер пары + weekType. Кнопка закрыть.
  - Поля: subject (select), lessonType (pill-кнопки с цветом), teacher (TeacherCombobox), room (RoomCombobox), target (radio group + nested selector), weekType (pills).
  - **TeacherCombobox:** fetch availability API. Показать: ✅ свободен, ❌ занят (чем), 📚 ведёт предмет. Disabled для занятых.
  - **RoomCombobox:** fetch availability API. Показать: capacity, тип, оборудование, занятость. Фильтр по minCapacity.
  - Auto-suggest: lessonType = lecture → target = stream; lessonType = lab → target = subgroup.

- **Сохранение:** Кнопка "Сохранить" → собрать все `_isNew/_modified/_moved/_deleted` → POST /api/schedule/entries/batch. Конфликт → подсветить ячейки + toast.

- **Keyboard shortcuts:** Delete, Escape, Arrow keys, Ctrl+S, Ctrl+Z (discard).
- **UnsavedChangesGuard:** beforeunload + route change.

### Definition of Done v0.5
- [x] Drag предмет из палитры → drop в ячейку → entry создан
- [x] Smart-селектор преподавателя: видно кто свободен/занят
- [x] Smart-селектор аудитории: видно вместимость, занятость
- [x] Batch save: 5 изменений → одно сохранение → атомарно
- [x] Swap: перетащить пару на занятую → обмен местами
- [x] Ctrl+S → сохранить

---

## ✅ v0.6 — Telegram-бот

> **Цель:** студент может посмотреть расписание в Telegram. Привязка аккаунта.

### Prisma — добавить поле

```
User: + telegramChatId String? @unique
```

### API — добавить

- `POST /api/auth/link-telegram { code, telegramChatId }` — привязка по одноразовому коду.

### Bot (apps/bot) — scaffold

- grammyJS, long polling. Middleware: session (in-memory), error handler, rate limiter.
- API client: service token для общих запросов, on-behalf-of для персональных.

### Команды

- `/start` — приветствие + инструкция по привязке.
- `/link` — генерация 6-значного кода (TTL 5 мин), ввести на сайте.
- `/schedule` — расписание на сегодня. Привязанный: своё. Непривязанный: `/schedule ИВТ-21-1`. Формат: emoji-пары, предмет, преподаватель, аудитория, тип. Отменённые пары помечены.
- `/schedule ГруппаName` — расписание произвольной группы. Fuzzy search.
- `/tomorrow` — shortcut.
- `/week` — на неделю. Inline keyboard навигация: ◀ Пред | Сегодня | След ▶. Edit message (не новое сообщение).
- `/teacher Иванов` — расписание преподавателя. Несколько совпадений → inline keyboard выбора.
- `/room 305а` — расписание аудитории.
- `/groups` — список групп по факультетам. Inline keyboard → расписание.
- `/me` — профиль: имя, роль, группа.
- `/help` — список команд.
- `bot.api.setMyCommands(...)` — регистрация в Telegram.

### Frontend — добавить

- Profile page: поле "Привязка Telegram" → ввод кода → POST /api/auth/link-telegram.

### Definition of Done v0.6
- [x] `/schedule ИВТ-21-1` → расписание в Telegram
- [x] Привязка аккаунта (код) → `/schedule` показывает персональное расписание
- [x] `/week` с inline-навигацией
- [x] `/teacher Иванов` → расписание

---

## ✅ v0.7 — Изменения расписания + уведомления

> **Цель:** преподаватель может запросить отмену. Менеджер одобряет. Студенты получают уведомления в Telegram. Полный workflow.

### Prisma — добавить

```
ScheduleChange (id, scheduleEntryId?, type, date, academicWeekId,
  replacementTeacherId?, replacementRoomId?, replacementTimeslotId?, replacementDate?,
  extraSubjectId?, extraLessonTypeId?, extraTeacherId?, extraRoomId?, extraTimeslotId?,
  extraGroupId?, extraSubgroupId?, extraStreamGroupId?,
  status, reason, comment?, requestedById, reviewedById?, createdAt, updatedAt, reviewedAt?)

  enum ChangeType { CANCEL, REPLACE_TEACHER, REPLACE_ROOM, RESCHEDULE, EXTRA }
  enum ChangeStatus { PENDING, APPROVED, REJECTED, REVOKED }

ChangeNotification (id, changeId, recipientId, channel, status, sentAt?, error?)
  enum NotificationChannel { TELEGRAM, WEB_PUSH, EMAIL }
  enum NotificationStatus { PENDING, SENT, FAILED, READ }

NotificationPreference (id, userId, telegramEnabled, webPushEnabled, emailEnabled,
  notifyOnCancel, notifyOnReplaceTeacher, notifyOnReplaceRoom, notifyOnReschedule, notifyClassReminder,
  quietHoursStart?, quietHoursEnd?)

SystemSettings (id='default', minCancelHoursDefault, minRescheduleHoursDefault,
  autoApproveCancel, autoApproveReplaceTeacher, autoApproveRoomChange, autoApproveReschedule, autoApproveExtra,
  notifyOnPending, notifyOnApproved, notifyOnRejected, notifyBeforeClass, notifyBeforeClassMinutes,
  extra, updatedAt, updatedById?)

SemesterSettings (id, semesterId, ...nullable overrides)
```

### API

- **Changes:**
  - `POST /api/changes` — создание. Discriminated union по type (Zod). Проверки: дедлайн (minCancelHours), дубликат, конфликты замены. Автоодобрение если настроено.
  - `GET /api/changes?status&type&from&to` — список. Manager: все. Teacher: только свои.
  - `GET /api/changes/:id` — детали.
  - `PATCH /api/changes/:id/approve` — одобрить. Повторная проверка конфликтов.
  - `PATCH /api/changes/:id/reject { comment }` — отклонить (comment обязателен).
  - `PATCH /api/changes/:id/revoke` — отозвать (только автор, только PENDING).

- **Обновить GET /api/schedule/group/:groupId:** наложение APPROVED changes на расписание. CANCEL → change info в ответе. REPLACE → подмена данных. EXTRA → добавить. RESCHEDULE → отмена + добавление на новую дату.

- **Settings:**
  - `GET /PATCH /api/admin/settings` — singleton.
  - `GET /PATCH /api/admin/settings/semester/:id` — override.
  - SettingsService: cache + merge (semester ?? global).

- **Notifications (синхронно для MVP, без Redis):**
  - При approve/reject → определить получателей → отправить через bot.api.sendMessage (прямо из API-процесса).
  - resolveRecipients: PENDING → менеджеры, APPROVED → студенты+преподы, REJECTED → автор.
  - HTML-формат, inline keyboard со ссылкой на web.

### Frontend

- `/changes` — **список изменений:**
  - Manager view: tabs (Ожидающие/Одобренные/Отклонённые/Все). Карточки: тип, предмет, дата, кто запросил, причина. Кнопки: одобрить/отклонить. Reject → модалка с обязательным комментарием.
  - Teacher view: мои запросы. Кнопка "Отозвать" для PENDING.
- `/changes/create` — **создание запроса (teacher):**
  - Шаг 1: выбрать занятие (из своих пар).
  - Шаг 2: выбрать дату (calendar picker, только будущие + правильные дни с учётом weekType + isActive недели).
  - Шаг 3: тип (Cancel / Replace) + причина. Replace → TeacherCombobox.
  - Submit → POST /api/changes. Ошибка дедлайна → показать.
- `/admin/settings` — **настройки:** дедлайны (numbers), автоодобрение (toggles), уведомления (toggles + minutes).
- Schedule viewer: обновить ScheduleCell — отображение изменений: отмена (перечёркнуто + красная метка), замена (🔄 + новое имя), перенос (метка).
- Profile: настройки уведомлений (каналы, типы, тихие часы).

### Bot — добавить

- `/cancel` — conversation flow: выбор пары (inline keyboard) → дата → причина → POST /api/changes.
- `/my_changes` — последние 10 запросов + статус.
- `/notifications` — настройки уведомлений (inline toggles).
- Приём уведомлений от API (bot.api.sendMessage напрямую).

### Definition of Done v0.7
- [x] Teacher: создать запрос на отмену → PENDING
- [x] Manager: одобрить → студенты получают уведомление в Telegram
- [x] Расписание: отменённая пара отображается перечёркнутой
- [x] Дедлайн: отмена за 2ч → ошибка
- [x] Автоодобрение смены аудитории работает
- [x] `/cancel` в боте → полный flow

---

## ✅ v0.8 — Очередь уведомлений (Redis + BullMQ)

> **Цель:** вынести отправку уведомлений в фоновый процесс. Масштабируемость, retry, мониторинг.

### Инфраструктура

- Docker-compose: + Redis, + PostgreSQL (миграция с SQLite).
- `packages/shared/src/redis.ts` — ioredis singleton.
- `packages/shared/src/queues/types.ts` — типы job'ов.

### Worker (apps/worker)

- BullMQ Worker: concurrency 10, rate limit 30/sec.
- Job types: `change_notification`, `class_reminder`, `direct_message`.
- Retry: 3 attempts, exponential backoff (5s → 25s → 125s).
- Хранение: completed 7d, failed 30d.

- **Dispatchers:**
  - TelegramDispatcher: bot.api.sendMessage (HTML, inline keyboard). Проверка telegramChatId.
  - WebPushDispatcher: web-push npm. Subscription в NotificationPreference. (отложено, не реализовано)
  - EmailDispatcher: nodemailer + SMTP (опционально). (отложено, не реализовано)

- **Quiet Hours:** проверить перед отправкой → если в тихих часах → moveToDelayed.

- **Message templates:** по типу изменения (CANCEL, REPLACE_TEACHER, etc.) — HTML + plain text.

### API — рефакторинг

- NotificationProducer: заменить синхронную отправку (v0.7) на `queue.add(...)`.
  - `enqueueChangeNotification(changeId, trigger)` — priority: APPROVED=1, PENDING=3.
  - `enqueueClassReminder(entryId, date, recipientIds)` — delayed job.

### Мониторинг

- Bull Board: Fastify adapter, route `/admin/queues` (admin only).
- `GET /api/admin/notifications/stats` — waiting, active, completed, failed, delayed.
- `GET /api/admin/notifications/failed` — последние 20 ошибок.
- `POST /api/admin/notifications/:jobId/retry`.

### Frontend — добавить

- `/admin/settings` — секция "Очередь уведомлений": live stats (polling 10s), link to Bull Board.

### Definition of Done v0.8
- [x] Approve change → job в Redis → worker отправляет в Telegram
- [x] Ошибка отправки → retry 3 раза → статус FAILED
- [x] Bull Board открывается, показывает очереди
- [x] Stats endpoint возвращает актуальные счётчики
- [x] PostgreSQL: миграция прошла, данные целы (выполнено в v1.0 — 2026-10-05, provider postgresql, единая миграция init_postgres)

---

## ✅ v0.9 — Полировка и edge cases (закрыто полностью 2026-10-05)

> **Цель:** стабилизация. Обработка всех edge cases, UX-улучшения, тесты.

### Функциональность

- **RESCHEDULE полный цикл:** перенос на другую дату/время. На оригинальную дату — "Перенесено на {дату}". На новую дату — пара появляется.
- **EXTRA полный цикл:** создание доп. занятия (не привязанного к шаблону). Все поля: предмет, тип, преподаватель, аудитория, слот, цель.
- **Semester Settings override:** nullable поля, fallback к global. UI: placeholder "По умолчанию: {value}", reset button.
- **iCal экспорт:** `GET /api/schedule/group/:id/export?format=ical` — генерация .ics файла. Подписка через URL в Google Calendar / Apple Calendar.
- **Расписание аудиторий:** `GET /api/schedule/room/:roomId` + страница `/schedule/room/[roomId]`.

### UX

- Пустые состояния: "Нет занятий", "Конфликтов не найдено ✅", "Нет запросов на изменения".
- Error boundaries: fallback UI при ошибках.
- Loading states: skeleton на таблицах и сетке.
- Responsive: проверить все страницы на мобильных.
- Accessibility: aria-labels, keyboard navigation в editor, focus management.

### Тесты

- Unit-тесты (vitest): ConflictService, SettingsService.getForSemester, resolveRecipients, weekType logic, audience size calculator.
- Integration тесты: auth flow, batch API, changes workflow (create → approve → check schedule).
- E2E (один happy path): login → create schedule → cancel → student sees cancellation.

### Definition of Done v0.9
- [x] RESCHEDULE: перенос пары → на старой дате "перенесено", на новой — пара
- [x] iCal: подписка на расписание в Google Calendar
- [x] 20+ unit-тестов проходят (7 unit-файлов: settingsService, telegramLink, conflicts, scheduleChanges, availability, changeService + integration-тест scheduleExportAuth)
- [x] E2E (Playwright): login → расписание → отмена → студент видит отмену (pnpm test:e2e, 3 прогона зелёные)
- [x] Все страницы работают на мобильных (UX-полировка: пустые состояния, skeleton, error boundary, responsive — commit 40bc777)
- [x] Нет 500 ошибок при обычном использовании (QA-смоук + тесты зелёные)

---

## ⬜ v1.0 — Release

> **Цель:** продакшн-релиз. Документация, деплой, финальный QA.

### Документация

- README.md: описание проекта, setup instructions, env variables.
- API docs: Swagger/OpenAPI (fastify-swagger) или TypeDoc.
- Deploy guide: docker-compose.prod.yml, env checklist, backup strategy.
- User guide: краткая инструкция для каждой роли (можно в wiki или Notion).

### Деплой

- docker-compose.prod.yml: api, web, bot, worker, postgres, redis (6 контейнеров).
  - Прод-сборка: multi-stage образы (текущий compose — dev-only, запускает `pnpm dev`).
  - Bot сейчас отсутствует в compose — добавить.
- Миграция БД SQLite → PostgreSQL (перевод provider в Prisma, пересоздание миграций, проверка данных).
- Env: production DATABASE_URL (PostgreSQL), REDIS_URL, JWT_SECRET, BOT_TOKEN.
- HTTPS: reverse proxy (nginx/caddy).
- Healthcheck endpoints для всех сервисов.
- Автоматический seed при первом запуске.

### Финальный QA

- Полный прогон всех ролей: admin → manager → teacher → student.
- Load test: 100 concurrent schedule requests.
- Security: проверка RBAC (student не может approve), rate limiting, input sanitization.
  - Rate limiting сейчас отключён (apps/api/src/server.ts) — включить при апгрейде на Fastify 5.
- Backup: pg_dump cron job.

### Definition of Done v1.0
- [x] docker-compose up → система полностью работает (docker-compose.prod.yml, проверено живым прогоном: proxy/web/api/seed/postgres/redis)
- [x] Все 4 роли: полный workflow без ошибок (E2E-поток admin/teacher/student + RBAC-проверки, QA-смоук 2026-10-05)
- [x] API docs доступны (Swagger UI `/docs`, spec `/docs/json`)
- [x] README достаточен для нового разработчика (README + docs/DEPLOYMENT.md + docs/SETUP.md)
- [x] 100 concurrent requests → ответ < 500ms (QA-смоук: бёрст 100 запросов за 367ms, 100/100 ok, p95 ≈ 248ms)

---

## v1.1+ — Бэклог (после релиза)

### Функциональность
- WebPush- и Email-каналы уведомлений (диспетчеры в worker, настройки в NotificationPreference — схема уже заложена).
- Полный набор настроек SystemSettings/SemesterSettings (сейчас реализованы minCancelHours и autoApproveReplaceRoom).
- Class reminder джобы (заготовка есть в worker).
- Уведомления менеджерам о новых PENDING-запросах.
- Мультиязычность (RU/EN).
- Экспорт расписания в PDF/Excel.

### Техдолг и инфраструктура
- E2E-тесты: happy path login → расписание → отмена → студент видит отмену (Playwright; планировались в v0.9).
- CI-пайплайн + turbo-задача `test` в корне (сейчас `pnpm test` ничего не прогоняет).
- RBAC-permissions: кеширование вместо загрузки ролей из БД на каждый запрос.
- Сессии бота в Redis (@grammyjs/storage-redis) вместо in-memory.
- Идемпотентность уведомлений (idempotency-ключи, защита от дублей при retry BullMQ).
- Аудит TelegramLinkCode (TTL, одноразовость).

---

## Сводка версий

| Версия | Статус | Что появляется | Новых моделей | Кто может пользоваться |
|---|---|---|---|---|
| **0.1** | ✅ | Скелет, auth, справочники | 11 | Admin |
| **0.2** | ✅ | Группы, преподаватели, семестры, недели | +10 (21) | Admin, Manager |
| **0.3** | ✅ | Просмотр расписания | +1 (22) | + Student, Teacher |
| **0.4** | ✅ | Редактор расписания (базовый) | — | Manager (создаёт расписание) |
| **0.5** | ✅ | DnD, batch, smart-селекторы | — | Manager (полноценный редактор) |
| **0.6** | ✅ | Telegram-бот | — | Student (бот) |
| **0.7** | ✅ | Изменения, уведомления, настройки | +5 (27) | Teacher (отмены), все (уведомления) |
| **0.8** | ✅ | Redis, BullMQ, worker (PostgreSQL-миграция отложена на v1.0) | — | Масштабируемость |
| **0.9** | 🔶 | Полировка, iCal, тесты (частично: E2E и UX-полировка не сделаны) | — | Стабильность |
| **1.0** | ⬜ | Деплой, документация | — | Продакшн |
| **1.1+** | ⬜ | Бэклог: WebPush/Email, расширенные настройки, class reminders, мультиязычность, PDF/Excel, E2E, CI, техдолг | — | После релиза |
