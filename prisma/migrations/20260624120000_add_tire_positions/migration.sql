-- AlterTable: per-tire tread depth (front/rear × left/right)
ALTER TABLE "TireMeasurement" ADD COLUMN "treadFrontLeftMm" DOUBLE PRECISION;
ALTER TABLE "TireMeasurement" ADD COLUMN "treadFrontRightMm" DOUBLE PRECISION;
ALTER TABLE "TireMeasurement" ADD COLUMN "treadRearLeftMm" DOUBLE PRECISION;
ALTER TABLE "TireMeasurement" ADD COLUMN "treadRearRightMm" DOUBLE PRECISION;
