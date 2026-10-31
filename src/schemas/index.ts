import { z } from "zod";

// CSV row schema for import
export const csvRowSchema = z.object({
  // Trim before the length check so a whitespace-only name is rejected, not imported as "".
  first_name: z.string().trim().min(1, "First name is required"),
  // A single-word line ("Madonna") is a guest with no surname.
  last_name: z.string().trim().default(""),
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
