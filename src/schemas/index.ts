import { z } from "zod";

// Guest schema
export const guestSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  notes: z.string().nullable(),
  phone: z.string().nullable(),
  group: z.string().nullable(),
  ticket_code: z.string().nullable(),
  stable_key: z.string(),
  is_deleted: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});

// Checkin schema
export const checkinSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  checked_in_at: z.string(),
  type: z.enum(["IN", "OUT"]),
  device_id: z.string(),
  synced_at: z.string().nullable(),
  created_at: z.string(),
});

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
  eventId: z.string().uuid("Invalid event ID"),
  accessCode: z.string().min(1, "Access code is required"),
});

export type GuestInput = z.input<typeof guestSchema>;
export type GuestOutput = z.output<typeof guestSchema>;
export type CsvRowInput = z.input<typeof csvRowSchema>;
export type CsvRowOutput = z.output<typeof csvRowSchema>;
export type LoginInput = z.input<typeof loginSchema>;
