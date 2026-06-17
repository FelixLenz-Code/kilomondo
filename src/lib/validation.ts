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
