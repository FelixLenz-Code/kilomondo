-- AlterTable: per-vehicle optional feature toggles
ALTER TABLE "Vehicle" ADD COLUMN "tripLogging" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN "leasingTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Vehicle" ADD COLUMN "evTracking" BOOLEAN NOT NULL DEFAULT false;
