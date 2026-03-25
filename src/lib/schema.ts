import { z } from "zod";

export const labourLineSchema = z.object({
  id: z.string(),
  role: z.string(),
  qty: z.number().min(1),
  shiftDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationHours: z.number().positive(),
});

export const nonLabourLineSchema = z.object({
  id: z.string(),
  description: z.string(),
  qty: z.number().min(1),
  amountExGst: z.number(),
});

export const quoteInputSchema = z.object({
  quoteNumber: z.string().optional().default(""),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyName: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  contactEmail: z.string().optional().default(""),
  contactPhone: z.string().optional().default(""),
  venue: z.string().optional(),
  notes: z.string().optional(),
  labour: z.array(labourLineSchema),
  nonLabour: z.array(nonLabourLineSchema),
});

export const rateRowSchema = z.object({
  role: z.string().min(1),
  day: z.number().min(0),
  night: z.number().min(0),
  sunday: z.number().min(0),
  publicHoliday: z.number().min(0),
  over8: z.number().min(0),
  over10: z.number().min(0),
});

export const appConfigSchema = z.object({
  currency: z.string().min(1),
  gstRate: z.number().min(0).max(1),
  minBillableHours: z.number().positive(),
  dayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  rates: z.array(rateRowSchema).min(1),
  publicHolidays: z.array(
  	z.object({
    	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    	label: z.string(),
  	})
  ),
  quoteText: z.object({
    termsAndConditions: z.string(),
  }),
});