import { z } from "zod";

export const TelegramChatIdSchema = z.string().trim().min(1).max(32);

export const TelegramLinkRequestSchema = z.object({
  telegramChatId: TelegramChatIdSchema
});

export const TelegramLinkConfirmSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  telegramChatId: TelegramChatIdSchema.optional()
});

