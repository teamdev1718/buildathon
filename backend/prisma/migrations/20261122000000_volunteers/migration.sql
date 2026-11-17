BEGIN;

-- CreateEnum
CREATE TYPE "app_private"."AnimalStatus" AS ENUM ('PENDING', 'SLAUGHTERED', 'PROCESSING', 'PACKED');

-- AlterTable
ALTER TABLE "app_private"."SlaughterAnimal" ADD COLUMN     "packedAt" TIMESTAMP(3),
ADD COLUMN     "processingAt" TIMESTAMP(3),
ADD COLUMN     "slaughteredAt" TIMESTAMP(3),
ADD COLUMN     "status" "app_private"."AnimalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "statusById" TEXT;

-- CreateTable
CREATE TABLE "app_private"."Volunteer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mahalluId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "canStatus" BOOLEAN NOT NULL DEFAULT false,
    "canDistribute" BOOLEAN NOT NULL DEFAULT false,
    "terminatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."MeatIssue" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "packets" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeatIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Distribution" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "packets" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Distribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Volunteer_userId_key" ON "app_private"."Volunteer"("userId");

-- CreateIndex
CREATE INDEX "Volunteer_mahalluId_terminatedAt_idx" ON "app_private"."Volunteer"("mahalluId", "terminatedAt");

-- CreateIndex
CREATE INDEX "MeatIssue_programId_volunteerId_idx" ON "app_private"."MeatIssue"("programId", "volunteerId");

-- CreateIndex
CREATE INDEX "Distribution_programId_volunteerId_idx" ON "app_private"."Distribution"("programId", "volunteerId");

-- CreateIndex
CREATE INDEX "Distribution_householdId_idx" ON "app_private"."Distribution"("householdId");

-- AddForeignKey
ALTER TABLE "app_private"."Volunteer" ADD CONSTRAINT "Volunteer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Volunteer" ADD CONSTRAINT "Volunteer_mahalluId_fkey" FOREIGN KEY ("mahalluId") REFERENCES "app_private"."Mahallu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MeatIssue" ADD CONSTRAINT "MeatIssue_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "app_private"."Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MeatIssue" ADD CONSTRAINT "MeatIssue_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Distribution" ADD CONSTRAINT "Distribution_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Distribution" ADD CONSTRAINT "Distribution_volunteerId_fkey" FOREIGN KEY ("volunteerId") REFERENCES "app_private"."Volunteer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Distribution" ADD CONSTRAINT "Distribution_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "app_private"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
