BEGIN;

-- CreateEnum
CREATE TYPE "app_private"."CycleStatus" AS ENUM ('ACTIVE', 'PROCUREMENT', 'DISTRIBUTION', 'CLOSED');

-- CreateEnum
CREATE TYPE "app_private"."AnimalType" AS ENUM ('GOAT', 'SHEEP', 'COW', 'CAMEL');

-- CreateEnum
CREATE TYPE "app_private"."EnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "app_private"."PaymentMethod" AS ENUM ('CASH', 'ONLINE');

-- CreateEnum
CREATE TYPE "app_private"."PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "app_private"."TokenKind" AS ENUM ('MEMBER', 'BENEFICIARY');

-- CreateEnum
CREATE TYPE "app_private"."TokenStatus" AS ENUM ('PENDING', 'COLLECTED');

-- CreateTable
CREATE TABLE "app_private"."UdhiyyaCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "priceLockDate" TIMESTAMP(3) NOT NULL,
    "status" "app_private"."CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "familyPercent" INTEGER NOT NULL DEFAULT 33,
    "relativesPercent" INTEGER NOT NULL DEFAULT 33,
    "poorPercent" INTEGER NOT NULL DEFAULT 34,
    "meatKgPerShare" INTEGER NOT NULL DEFAULT 10,
    "slots" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UdhiyyaCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."AnimalPlan" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "animalType" "app_private"."AnimalType" NOT NULL,
    "sharePrice" INTEGER NOT NULL,
    "sharesPerAnimal" INTEGER NOT NULL,

    CONSTRAINT "AnimalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Enrollment" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "holderNames" TEXT[],
    "totalAmount" INTEGER NOT NULL,
    "installments" INTEGER NOT NULL,
    "monthlyAmount" INTEGER NOT NULL,
    "status" "app_private"."EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Payment" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "app_private"."PaymentMethod" NOT NULL,
    "status" "app_private"."PaymentStatus" NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Animal" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "animalType" "app_private"."AnimalType" NOT NULL,
    "label" TEXT NOT NULL,
    "weightKg" INTEGER,
    "cost" INTEGER,
    "seller" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Beneficiary" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "area" TEXT NOT NULL,
    "address" TEXT,
    "needsDelivery" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."MeatToken" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "kind" "app_private"."TokenKind" NOT NULL,
    "userId" TEXT,
    "beneficiaryId" TEXT,
    "code" TEXT NOT NULL,
    "slot" TEXT,
    "grams" INTEGER NOT NULL,
    "delivery" BOOLEAN NOT NULL DEFAULT false,
    "status" "app_private"."TokenStatus" NOT NULL DEFAULT 'PENDING',
    "collectedAt" TIMESTAMP(3),
    "collectedById" TEXT,

    CONSTRAINT "MeatToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UdhiyyaCycle_status_idx" ON "app_private"."UdhiyyaCycle"("status");

-- CreateIndex
CREATE INDEX "AnimalPlan_cycleId_idx" ON "app_private"."AnimalPlan"("cycleId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "app_private"."Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_cycleId_status_idx" ON "app_private"."Enrollment"("cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_cycleId_userId_planId_key" ON "app_private"."Enrollment"("cycleId", "userId", "planId");

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_status_idx" ON "app_private"."Payment"("enrollmentId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "app_private"."Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Animal_cycleId_idx" ON "app_private"."Animal"("cycleId");

-- CreateIndex
CREATE INDEX "Beneficiary_active_idx" ON "app_private"."Beneficiary"("active");

-- CreateIndex
CREATE UNIQUE INDEX "MeatToken_code_key" ON "app_private"."MeatToken"("code");

-- CreateIndex
CREATE INDEX "MeatToken_cycleId_status_idx" ON "app_private"."MeatToken"("cycleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeatToken_cycleId_userId_key" ON "app_private"."MeatToken"("cycleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MeatToken_cycleId_beneficiaryId_key" ON "app_private"."MeatToken"("cycleId", "beneficiaryId");

-- AddForeignKey
ALTER TABLE "app_private"."AnimalPlan" ADD CONSTRAINT "AnimalPlan_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_private"."UdhiyyaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Enrollment" ADD CONSTRAINT "Enrollment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_private"."UdhiyyaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Enrollment" ADD CONSTRAINT "Enrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "app_private"."AnimalPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "app_private"."Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Animal" ADD CONSTRAINT "Animal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_private"."UdhiyyaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MeatToken" ADD CONSTRAINT "MeatToken_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "app_private"."UdhiyyaCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MeatToken" ADD CONSTRAINT "MeatToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MeatToken" ADD CONSTRAINT "MeatToken_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "app_private"."Beneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Roles and permissions
INSERT INTO "app_private"."Role" ("name") VALUES ('COLLECTOR');
INSERT INTO "app_private"."Permission" ("name") VALUES ('udhiyya.manage'), ('udhiyya.collect');
INSERT INTO "app_private"."RolePermission" ("roleName", "permissionName")
VALUES ('ADMIN', 'udhiyya.manage'), ('ADMIN', 'udhiyya.collect'), ('COLLECTOR', 'udhiyya.collect');

COMMIT;
