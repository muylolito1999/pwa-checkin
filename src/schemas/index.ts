import { z } from "zod";

// CSV row schema for import
export const csvRowSchema = z.object({
  first_name: z.string().min(1, "First name is required").transform((s) => s.trim()),
  last_name: z.string().min(1, "Last name is required").transform((s) => s.trim()),
  notes: z.string().optional().transform((s) => s?.trim() || null),
  phone: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return null;
      // Extract digits only
      const digits = s.replace(/\D/g, "");
      return digits.length >= 10 ? digits : null;
    }),
  group: z.string().optional().transform((s) => s?.trim() || null),
  ticket_code: z.string().optional().transform((s) => s?.trim() || null),
});

// Login schema
export const loginSchema = z.object({
  eventId: z.uuid("Event ID must be a valid UUID"),
  accessCode: z
    .string()
    .trim()
    .optional()
    .transform((s) => s || undefined),
});

export type CsvRowInput = z.input<typeof csvRowSchema>;
export type CsvRowOutput = z.output<typeof csvRowSchema>;
export type LoginInput = z.input<typeof loginSchema>;
