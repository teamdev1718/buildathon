BEGIN;

-- CreateEnum
CREATE TYPE "app_private"."ProgramStatus" AS ENUM ('DRAFT', 'OPEN', 'ENDED');

-- CreateEnum
CREATE TYPE "app_private"."PayMode" AS ENUM ('ONE_TIME', 'INSTALLMENTS');

-- CreateTable
CREATE TABLE "app_private"."Program" (
    "id" TEXT NOT NULL,
    "mahalluId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "status" "app_private"."ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "openedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."ProgramAnimal" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "animalType" "app_private"."AnimalType" NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sharesPerAnimal" INTEGER NOT NULL,

    CONSTRAINT "ProgramAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Booking" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "animalType" "app_private"."AnimalType" NOT NULL,
    "shares" INTEGER NOT NULL,
    "payMode" "app_private"."PayMode" NOT NULL DEFAULT 'INSTALLMENTS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Program_mahalluId_status_idx" ON "app_private"."Program"("mahalluId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAnimal_programId_animalType_key" ON "app_private"."ProgramAnimal"("programId", "animalType");

-- CreateIndex
CREATE INDEX "Booking_householdId_idx" ON "app_private"."Booking"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_programId_householdId_animalType_key" ON "app_private"."Booking"("programId", "householdId", "animalType");

-- AddForeignKey
ALTER TABLE "app_private"."Program" ADD CONSTRAINT "Program_mahalluId_fkey" FOREIGN KEY ("mahalluId") REFERENCES "app_private"."Mahallu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."ProgramAnimal" ADD CONSTRAINT "ProgramAnimal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Booking" ADD CONSTRAINT "Booking_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Booking" ADD CONSTRAINT "Booking_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "app_private"."Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
