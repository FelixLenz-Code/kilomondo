-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "adblueTracking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FuelEntry" ADD COLUMN "adbluePrice" DOUBLE PRECISION;
