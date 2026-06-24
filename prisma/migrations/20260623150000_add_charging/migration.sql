-- CreateEnum
CREATE TYPE "ChargingLocation" AS ENUM ('HOME', 'PUBLIC', 'WORK', 'OTHER');

-- CreateTable
CREATE TABLE "ChargingSession" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "pricePerKwh" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "location" "ChargingLocation" NOT NULL DEFAULT 'HOME',
    "provider" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargingSession_vehicleId_idx" ON "ChargingSession"("vehicleId");

-- AddForeignKey
ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
