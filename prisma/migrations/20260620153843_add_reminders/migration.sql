-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('INSPECTION', 'SERVICE', 'INSURANCE', 'TAX', 'LOG', 'CUSTOM');

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL DEFAULT 'CUSTOM',
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "dueOdometer" INTEGER,
    "leadDays" INTEGER NOT NULL DEFAULT 28,
    "intervalDays" INTEGER,
    "recurrenceMonths" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_vehicleId_idx" ON "Reminder"("vehicleId");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
