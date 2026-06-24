-- CreateTable
CREATE TABLE "TireMeasurement" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tireSetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "treadDepthMm" DOUBLE PRECISION NOT NULL,
    "odometer" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TireMeasurement_vehicleId_idx" ON "TireMeasurement"("vehicleId");

-- CreateIndex
CREATE INDEX "TireMeasurement_tireSetId_idx" ON "TireMeasurement"("tireSetId");

-- AddForeignKey
ALTER TABLE "TireMeasurement" ADD CONSTRAINT "TireMeasurement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMeasurement" ADD CONSTRAINT "TireMeasurement_tireSetId_fkey" FOREIGN KEY ("tireSetId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
