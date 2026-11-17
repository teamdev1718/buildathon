BEGIN;

-- AlterTable
ALTER TABLE "app_private"."Program" ADD COLUMN     "allocatedAt" TIMESTAMP(3),
ADD COLUMN     "drawMinutes" INTEGER,
ADD COLUMN     "drawStartAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "app_private"."SlaughterAnimal" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "animalType" "app_private"."AnimalType" NOT NULL,
    "code" TEXT NOT NULL,
    "drawOrder" INTEGER,
    "slotAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaughterAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."ShareAllocation" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,

    CONSTRAINT "ShareAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlaughterAnimal_programId_drawOrder_idx" ON "app_private"."SlaughterAnimal"("programId", "drawOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SlaughterAnimal_programId_code_key" ON "app_private"."SlaughterAnimal"("programId", "code");

-- CreateIndex
CREATE INDEX "ShareAllocation_bookingId_idx" ON "app_private"."ShareAllocation"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareAllocation_animalId_bookingId_key" ON "app_private"."ShareAllocation"("animalId", "bookingId");

-- AddForeignKey
ALTER TABLE "app_private"."SlaughterAnimal" ADD CONSTRAINT "SlaughterAnimal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."ShareAllocation" ADD CONSTRAINT "ShareAllocation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "app_private"."SlaughterAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."ShareAllocation" ADD CONSTRAINT "ShareAllocation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "app_private"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
