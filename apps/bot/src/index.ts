import { Bot, Context, InlineKeyboard, session, type SessionFlavor } from "grammy";
import { limit } from "@grammyjs/ratelimiter";
import { env } from "./env.js";
import { addDays, dow, formatDateISO } from "./dates.js";
import { formatDaySchedule, formatWeekSchedule } from "./format.js";
import { createChange, myChanges, requestLinkCode, scheduleGroup, scheduleMe, scheduleRoom, scheduleTeacher, searchGroups, searchRooms, searchTeachers } from "./api.js";

// Check if bot token is configured
if (!env.TELEGRAM_BOT_TOKEN) {
  console.log("[Bot] TELEGRAM_BOT_TOKEN not set. Bot will not start.");
  process.exit(0);
}

type SessionData = {
  lastGroupId?: string;
  lastTeacherId?: string;
  lastRoomId?: string;
  lastTarget?: { kind: "me" | "group" | "teacher" | "room"; id?: string };
  cancelDraft?: { lessonId: string; date: string } | null;
};

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(env.TELEGRAM_BOT_TOKEN);

bot.use(session({ initial: (): SessionData => ({}) }));
bot.use(
  limit({
    timeFrame: 1000,
    limit: 5,
    onLimitExceeded: (ctx) => ctx.reply("Слишком часто. Попробуйте чуть позже.")
  })
);

async function resolveGroupByQuery(q: string) {
  const { items } = await searchGroups(q);
  const exact = items.find((x) => x.name.toLowerCase() === q.toLowerCase());
  if (exact) return { kind: "one" as const, item: exact };
  if (items.length === 1) return { kind: "one" as const, item: items[0]! };
  if (!items.length) return { kind: "none" as const };
  return { kind: "many" as const, items };
}

async function resolveTeacherByQuery(q: string) {
  const { items } = await searchTeachers(q);
  const exact = items.find((x) => x.user.lastName.toLowerCase() === q.toLowerCase());
  if (exact) return { kind: "one" as const, item: exact };
  if (items.length === 1) return { kind: "one" as const, item: items[0]! };
  if (!items.length) return { kind: "none" as const };
  return { kind: "many" as const, items };
}

async function resolveRoomByQuery(q: string) {
  const { items } = await searchRooms(q);
  const exact = items.find((x) => x.name.toLowerCase() === q.toLowerCase());
  if (exact) return { kind: "one" as const, item: exact };
  if (items.length === 1) return { kind: "one" as const, item: items[0]! };
  if (!items.length) return { kind: "none" as const };
  return { kind: "many" as const, items };
}

bot.command("start", async (ctx) => {
  await ctx.reply("Команды: /link, /schedule, /tomorrow, /week, /teacher, /room, /help");
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "/link — получить код привязки",
      "/schedule — расписание на сегодня (если привязан)",
      "/schedule ИВТ-21-1 — расписание группы на сегодня",
      "/tomorrow — расписание на завтра",
      "/week — расписание на неделю (inline навигация)",
      "/teacher Иванов — расписание преподавателя на сегодня",
      "/room 101 — расписание аудитории на сегодня",
      "/cancel — запросить отмену пары",
      "/my_changes — мои запросы"
    ].join("\n")
  );
});

bot.command("link", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  if (!chatId) return;
  const res = await requestLinkCode(chatId);
  await ctx.reply(`Код привязки: ${res.code}\nОткройте /profile и введите этот код (действует 5 минут).`);
});

bot.command("schedule", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  const arg = ctx.match?.toString().trim();
  const today = new Date();
  const date = formatDateISO(today);

  if (!arg) {
    try {
      const payload = await scheduleMe(chatId, date);
      ctx.session.lastTarget = { kind: "me" };
      await ctx.reply(formatDaySchedule(payload, today));
    } catch {
      await ctx.reply("Аккаунт не привязан. Используйте /link и затем введите код на /profile, или укажите группу: /schedule ИВТ-21-1");
    }
    return;
  }

  const r = await resolveGroupByQuery(arg);
  if (r.kind === "none") return void ctx.reply("Группа не найдена.");
  if (r.kind === "many") {
    const kb = new InlineKeyboard();
    for (const g of r.items.slice(0, 10)) kb.text(g.name, `schg:${g.id}:${date}`).row();
    await ctx.reply("Найдено несколько групп:", { reply_markup: kb });
    return;
  }

  ctx.session.lastGroupId = r.item.id;
  ctx.session.lastTarget = { kind: "group", id: r.item.id };
  const payload = await scheduleGroup(r.item.id, date);
  await ctx.reply(formatDaySchedule(payload, today));
});

bot.command("tomorrow", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  const t = addDays(new Date(), 1);
  const date = formatDateISO(t);

  try {
    const payload = ctx.session.lastTarget?.kind === "group" && ctx.session.lastTarget.id
      ? await scheduleGroup(ctx.session.lastTarget.id, date)
      : await scheduleMe(chatId, date);
    await ctx.reply(formatDaySchedule(payload, t));
  } catch {
    await ctx.reply("Не удалось получить расписание. Если аккаунт не привязан — используйте /schedule <группа>.");
  }
});

bot.command("week", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  const today = new Date();
  const date = formatDateISO(today);

  let payload: any;
  try {
    payload =
      ctx.session.lastTarget?.kind === "group" && ctx.session.lastTarget.id
        ? await scheduleGroup(ctx.session.lastTarget.id, date)
        : await scheduleMe(chatId, date);
    ctx.session.lastTarget = ctx.session.lastTarget ?? { kind: "me" };
  } catch {
    await ctx.reply("Не удалось получить расписание. Если аккаунт не привязан — используйте /schedule <группа> и затем /week.");
    return;
  }

  const kb = new InlineKeyboard().text("◀️", `week:${-7}:${date}`).text("Сегодня", `week:0:${date}`).text("▶️", `week:${7}:${date}`);
  await ctx.reply(formatWeekSchedule(payload), { reply_markup: kb });
});

bot.command("cancel", async (ctx) => {
  const today = new Date();
  const kb = new InlineKeyboard();
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const ds = formatDateISO(d);
    kb.text(ds, `cdate:${ds}`);
    if (i % 2 === 1) kb.row();
  }
  ctx.session.cancelDraft = null;
  await ctx.reply("Выберите дату:", { reply_markup: kb });
});

bot.callbackQuery(/^cdate:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const date = ctx.match[1]!;
  const chatId = String(ctx.chat?.id ?? "");
  try {
    const payload = await scheduleMe(chatId, date);
    const day = dow(new Date(`${date}T00:00:00Z`));
    const dayItems = (payload.items ?? []).filter((e: any) => Number(e.dayOfWeek) === day);
    if (!dayItems.length) {
      await ctx.editMessageText("На эту дату пар нет.");
      await ctx.answerCallbackQuery();
      return;
    }
    const kb = new InlineKeyboard();
    for (const e of dayItems.slice(0, 12)) {
      const label = `№${e.timeslot?.number ?? "—"} ${e.subject?.code ?? "—"}`;
      kb.text(label, `clesson:${e.id}:${date}`).row();
    }
    await ctx.editMessageText("Выберите пару:", { reply_markup: kb });
  } catch {
    await ctx.editMessageText("Не удалось получить расписание. Убедитесь, что аккаунт привязан (/link).");
  }
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^clesson:(.+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const lessonId = ctx.match[1]!;
  const date = ctx.match[2]!;
  ctx.session.cancelDraft = { lessonId, date };
  await ctx.reply("Введите причину отмены (сообщением):");
  await ctx.answerCallbackQuery();
});

bot.on("message:text", async (ctx) => {
  if (!ctx.session.cancelDraft) return;
  const chatId = String(ctx.chat?.id ?? "");
  const text = ctx.message.text.trim();
  const draft = ctx.session.cancelDraft;
  ctx.session.cancelDraft = null;

  if (!text.length) {
    await ctx.reply("Причина не может быть пустой.");
    return;
  }

  try {
    await createChange(chatId, { type: "CANCEL", lessonId: draft.lessonId, date: draft.date, reason: text });
    await ctx.reply("Запрос отправлен. Статус: PENDING");
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("DEADLINE")) return void ctx.reply("Нельзя отменить так поздно: нарушен дедлайн.");
    if (msg.includes("DUPLICATE")) return void ctx.reply("Похожий запрос уже существует.");
    await ctx.reply("Не удалось создать запрос.");
  }
});

bot.command("my_changes", async (ctx) => {
  const chatId = String(ctx.chat?.id ?? "");
  try {
    const res = await myChanges(chatId);
    if (!res.items?.length) return void ctx.reply("Запросов нет.");
    const lines = res.items.slice(0, 10).map((c: any) => `${c.type} · ${c.status} · ${String(c.date).slice(0, 10)}`);
    await ctx.reply(lines.join("\n"));
  } catch {
    await ctx.reply("Не удалось получить список. Убедитесь, что аккаунт привязан (/link).");
  }
});

bot.command("teacher", async (ctx) => {
  const q = ctx.match?.toString().trim();
  if (!q) return void ctx.reply("Использование: /teacher Иванов");
  const today = new Date();
  const date = formatDateISO(today);

  const r = await resolveTeacherByQuery(q);
  if (r.kind === "none") return void ctx.reply("Преподаватель не найден.");
  if (r.kind === "many") {
    const kb = new InlineKeyboard();
    for (const t of r.items.slice(0, 10)) kb.text(`${t.user.lastName} ${t.user.firstName}`, `scht:${t.id}:${date}`).row();
    await ctx.reply("Найдено несколько преподавателей:", { reply_markup: kb });
    return;
  }

  ctx.session.lastTeacherId = r.item.id;
  ctx.session.lastTarget = { kind: "teacher", id: r.item.id };
  const payload = await scheduleTeacher(r.item.id, date);
  await ctx.reply(formatDaySchedule(payload, today));
});

bot.command("room", async (ctx) => {
  const q = ctx.match?.toString().trim();
  if (!q) return void ctx.reply("Использование: /room 101");
  const today = new Date();
  const date = formatDateISO(today);

  const r = await resolveRoomByQuery(q);
  if (r.kind === "none") return void ctx.reply("Аудитория не найдена.");
  if (r.kind === "many") {
    const kb = new InlineKeyboard();
    for (const rm of r.items.slice(0, 10)) kb.text(rm.name, `schr:${rm.id}:${date}`).row();
    await ctx.reply("Найдено несколько аудиторий:", { reply_markup: kb });
    return;
  }

  ctx.session.lastRoomId = r.item.id;
  ctx.session.lastTarget = { kind: "room", id: r.item.id };
  const payload = await scheduleRoom(r.item.id, date);
  await ctx.reply(formatDaySchedule(payload, today));
});

bot.callbackQuery(/^schg:(.+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const groupId = ctx.match[1]!;
  const date = ctx.match[2]!;
  const payload = await scheduleGroup(groupId, date);
  ctx.session.lastTarget = { kind: "group", id: groupId };
  await ctx.editMessageText(formatDaySchedule(payload, new Date(date)));
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^scht:(.+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const teacherId = ctx.match[1]!;
  const date = ctx.match[2]!;
  const payload = await scheduleTeacher(teacherId, date);
  ctx.session.lastTarget = { kind: "teacher", id: teacherId };
  await ctx.editMessageText(formatDaySchedule(payload, new Date(date)));
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^schr:(.+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const roomId = ctx.match[1]!;
  const date = ctx.match[2]!;
  const payload = await scheduleRoom(roomId, date);
  ctx.session.lastTarget = { kind: "room", id: roomId };
  await ctx.editMessageText(formatDaySchedule(payload, new Date(date)));
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^week:(-?\d+):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  const delta = Number(ctx.match[1]);
  const base = new Date(ctx.match[2]!);
  const next = addDays(base, delta);
  const date = formatDateISO(next);

  const chatId = String(ctx.chat?.id ?? "");
  const target = ctx.session.lastTarget ?? { kind: "me" as const };

  const payload =
    target.kind === "group" && target.id
      ? await scheduleGroup(target.id, date)
      : target.kind === "teacher" && target.id
        ? await scheduleTeacher(target.id, date)
        : target.kind === "room" && target.id
          ? await scheduleRoom(target.id, date)
          : await scheduleMe(chatId, date);

  const kb = new InlineKeyboard().text("◀️", `week:${-7}:${date}`).text("Сегодня", `week:0:${date}`).text("▶️", `week:${7}:${date}`);
  await ctx.editMessageText(formatWeekSchedule(payload), { reply_markup: kb });
  await ctx.answerCallbackQuery();
});

bot.catch(async (err) => {
  console.error(err.error);
});

await bot.api.setMyCommands([
  { command: "start", description: "Старт" },
  { command: "link", description: "Привязать аккаунт" },
  { command: "schedule", description: "Расписание на сегодня" },
  { command: "tomorrow", description: "Расписание на завтра" },
  { command: "week", description: "Расписание на неделю" },
  { command: "teacher", description: "Расписание преподавателя" },
  { command: "room", description: "Расписание аудитории" },
  { command: "cancel", description: "Запросить отмену" },
  { command: "my_changes", description: "Мои запросы" },
  { command: "help", description: "Справка" }
]);

bot.start();
