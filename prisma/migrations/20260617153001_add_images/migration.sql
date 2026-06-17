/*
  Warnings:

  - You are about to drop the column `photoUrl` on the `Vehicle` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CleaningEntry" ADD COLUMN     "afterImageId" TEXT,
ADD COLUMN     "beforeImageId" TEXT;

-- AlterTable
ALTER TABLE "RepairEntry" ADD COLUMN     "afterImageId" TEXT,
ADD COLUMN     "beforeImageId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "photoUrl",
ADD COLUMN     "coverImageId" TEXT;

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);
