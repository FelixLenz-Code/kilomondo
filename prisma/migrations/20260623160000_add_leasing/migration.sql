-- CreateTable
CREATE TABLE "LeasingContract" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "provider" TEXT,
    "monthlyRate" DOUBLE PRECISION,
    "downPayment" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startOdometer" INTEGER NOT NULL DEFAULT 0,
    "annualKmLimit" INTEGER,
    "excessKmCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeasingContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeasingContract_vehicleId_key" ON "LeasingContract"("vehicleId");

-- AddForeignKey
ALTER TABLE "LeasingContract" ADD CONSTRAINT "LeasingContract_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
