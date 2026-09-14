import { z } from "zod";

export const RegisterBodySchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50)
});

export const LoginBodySchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(72)
});

export const RefreshBodySchema = z.object({});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
