/*
  Warnings:

  - You are about to drop the column `afterImageId` on the `CleaningEntry` table. All the data in the column will be lost.
  - You are about to drop the column `beforeImageId` on the `CleaningEntry` table. All the data in the column will be lost.
  - You are about to drop the column `afterImageId` on the `RepairEntry` table. All the data in the column will be lost.
  - You are about to drop the column `beforeImageId` on the `RepairEntry` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('BEFORE', 'AFTER');

-- AlterTable
ALTER TABLE "CleaningEntry" DROP COLUMN "afterImageId",
DROP COLUMN "beforeImageId";

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "cleaningId" TEXT,
ADD COLUMN     "kind" "ImageKind",
ADD COLUMN     "repairId" TEXT;

-- AlterTable
ALTER TABLE "RepairEntry" DROP COLUMN "afterImageId",
DROP COLUMN "beforeImageId";

-- CreateIndex
CREATE INDEX "Image_repairId_idx" ON "Image"("repairId");

-- CreateIndex
CREATE INDEX "Image_cleaningId_idx" ON "Image"("cleaningId");
