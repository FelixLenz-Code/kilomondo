-- CreateEnum
CREATE TYPE "TireSeason" AS ENUM ('SUMMER', 'WINTER', 'ALLSEASON');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "tireTracking" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TireSet" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season" "TireSeason" NOT NULL DEFAULT 'SUMMER',
    "dimension" TEXT,
    "brand" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "treadDepthMm" DOUBLE PRECISION,
    "storageLocation" TEXT,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TireChange" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tireSetId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometer" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TireSet_vehicleId_idx" ON "TireSet"("vehicleId");

-- CreateIndex
CREATE INDEX "TireChange_vehicleId_idx" ON "TireChange"("vehicleId");

-- CreateIndex
CREATE INDEX "TireChange_tireSetId_idx" ON "TireChange"("tireSetId");

-- AddForeignKey
ALTER TABLE "TireSet" ADD CONSTRAINT "TireSet_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireChange" ADD CONSTRAINT "TireChange_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireChange" ADD CONSTRAINT "TireChange_tireSetId_fkey" FOREIGN KEY ("tireSetId") REFERENCES "TireSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
