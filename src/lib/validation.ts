import { z } from "zod";

// FormData.get() returns `string | null`, so optional fields must tolerate
// null (an absent field) as well as undefined and empty strings.
const optionalString = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v == null || v === "" ? undefined : v));

const coerceNumber = z.coerce.number({ invalid_type_error: "Zahl erforderlich" });

// Optional, non-negative integer. Empty string / null (unfilled field) -> undefined
// so a nullable column stays null instead of being coerced to 0.
const optionalOdometer = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  coerceNumber.int().min(0).optional()
);

export const loginSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort erforderlich"),
});

export const vehicleSchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich").max(80),
  make: optionalString,
  model: optionalString,
  year: z.coerce
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  licensePlate: optionalString.transform((v) => v?.toUpperCase()),
  vin: optionalString.transform((v) => v?.toUpperCase()),
  fuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG"]),
  color: optionalString,
  initialOdometer: coerceNumber.int().min(0).default(0),
});

export const fuelSchema = z.object({
  date: z.coerce.date(),
  odometer: coerceNumber.int().min(0),
  amount: coerceNumber.positive("Menge muss > 0 sein"),
  pricePerUnit: coerceNumber.min(0),
  totalCost: coerceNumber.min(0),
  isFullTank: z.coerce.boolean().default(true),
  station: optionalString,
  notes: optionalString,
});

export const odometerSchema = z.object({
  date: z.coerce.date(),
  odometer: coerceNumber.int().min(0),
  note: optionalString,
});

export const repairSchema = z.object({
  date: z.coerce.date(),
  odometer: optionalOdometer,
  title: z.string().trim().min(1, "Titel erforderlich").max(120),
  description: optionalString,
  category: z.enum(["REPAIR", "SERVICE", "INSPECTION", "TIRES", "OTHER"]),
  cost: coerceNumber.min(0).default(0),
  workshop: optionalString,
  notes: optionalString,
});

export const cleaningSchema = z.object({
  date: z.coerce.date(),
  odometer: optionalOdometer,
  type: z.enum(["INTERIOR", "EXTERIOR", "FULL"]),
  cost: coerceNumber.min(0).default(0),
  products: optionalString,
  notes: optionalString,
});

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    coerceNumber.int().min(min).max(max).optional()
  );

export const reminderSchema = z.object({
  type: z.enum(["INSPECTION", "SERVICE", "INSURANCE", "TAX", "LOG", "CUSTOM"]).default("CUSTOM"),
  title: z.string().trim().min(1, "Titel erforderlich").max(120),
  dueDate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.date().optional()
  ),
  dueOdometer: optionalOdometer,
  leadDays: z
    .preprocess((v) => (v === "" || v == null ? undefined : v), coerceNumber.int().min(0).max(365).optional())
    .transform((v) => v ?? 28),
  intervalDays: optionalInt(1, 3650),
  recurrenceMonths: optionalInt(1, 120),
});

export const canisterSchema = z.object({
  name: z.string().trim().min(1, "Name erforderlich").max(80),
  capacity: coerceNumber.positive("Kapazität muss > 0 sein"),
  fuelType: z
    .enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "LPG"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: optionalString,
});

// A canister fill (purchase). Reused standalone and as the optional "also
// filled a canister" block of the car fuel form.
export const canisterFillSchema = z.object({
  date: z.coerce.date(),
  liters: coerceNumber.positive("Menge muss > 0 sein"),
  pricePerUnit: coerceNumber.min(0),
  totalCost: coerceNumber.min(0),
  station: optionalString,
  notes: optionalString,
});

// Pouring fuel from a canister into the car. Cost/price come from the canister,
// so they are not part of the form.
export const canisterPourSchema = z.object({
  date: z.coerce.date(),
  odometer: coerceNumber.int().min(0),
  amount: coerceNumber.positive("Menge muss > 0 sein"),
  isFullTank: z.coerce.boolean().default(false),
  notes: optionalString,
});

export const createUserSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  name: z.string().trim().min(1, "Name erforderlich").max(80),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
    newPassword: z.string().min(8, "Mindestens 8 Zeichen"),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });
