-- AlterTable: per-set tread-wear alert threshold + linked reminder
ALTER TABLE "TireSet" ADD COLUMN "wearAlertMm" DOUBLE PRECISION;
ALTER TABLE "TireSet" ADD COLUMN "reminderId" TEXT;
