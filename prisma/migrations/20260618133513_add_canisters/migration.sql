-- CreateEnum
CREATE TYPE "FuelEntryKind" AS ENUM ('CAR', 'CANISTER');

-- AlterTable
ALTER TABLE "FuelEntry" ADD COLUMN     "canisterId" TEXT,
ADD COLUMN     "kind" "FuelEntryKind" NOT NULL DEFAULT 'CAR';

-- CreateTable
CREATE TABLE "Canister" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "fuelType" "FuelType",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Canister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanisterFill" (
    "id" TEXT NOT NULL,
    "canisterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "station" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanisterFill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Canister_userId_idx" ON "Canister"("userId");

-- CreateIndex
CREATE INDEX "CanisterFill_canisterId_idx" ON "CanisterFill"("canisterId");

-- CreateIndex
CREATE INDEX "FuelEntry_canisterId_idx" ON "FuelEntry"("canisterId");

-- AddForeignKey
ALTER TABLE "FuelEntry" ADD CONSTRAINT "FuelEntry_canisterId_fkey" FOREIGN KEY ("canisterId") REFERENCES "Canister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Canister" ADD CONSTRAINT "Canister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanisterFill" ADD CONSTRAINT "CanisterFill_canisterId_fkey" FOREIGN KEY ("canisterId") REFERENCES "Canister"("id") ON DELETE CASCADE ON UPDATE CASCADE;
