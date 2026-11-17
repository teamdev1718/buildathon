BEGIN;

-- CreateEnum
CREATE TYPE "app_private"."StaffRole" AS ENUM ('MAHALLU_ADMIN', 'VOLUNTEER');

-- AlterTable
ALTER TABLE "app_private"."User" ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "app_private"."Mahallu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mahallu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."MahalluStaff" (
    "userId" TEXT NOT NULL,
    "mahalluId" TEXT NOT NULL,
    "role" "app_private"."StaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MahalluStaff_pkey" PRIMARY KEY ("userId","mahalluId","role")
);

-- CreateTable
CREATE TABLE "app_private"."Household" (
    "id" TEXT NOT NULL,
    "mahalluId" TEXT NOT NULL,
    "mahalluNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mahallu_code_key" ON "app_private"."Mahallu"("code");

-- CreateIndex
CREATE INDEX "MahalluStaff_mahalluId_role_idx" ON "app_private"."MahalluStaff"("mahalluId", "role");

-- CreateIndex
CREATE INDEX "Household_mahalluId_ownerName_idx" ON "app_private"."Household"("mahalluId", "ownerName");

-- CreateIndex
CREATE INDEX "Household_phone_idx" ON "app_private"."Household"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Household_mahalluId_mahalluNumber_key" ON "app_private"."Household"("mahalluId", "mahalluNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Household_userId_mahalluId_key" ON "app_private"."Household"("userId", "mahalluId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "app_private"."User"("username");

-- AddForeignKey
ALTER TABLE "app_private"."MahalluStaff" ADD CONSTRAINT "MahalluStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."MahalluStaff" ADD CONSTRAINT "MahalluStaff_mahalluId_fkey" FOREIGN KEY ("mahalluId") REFERENCES "app_private"."Mahallu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Household" ADD CONSTRAINT "Household_mahalluId_fkey" FOREIGN KEY ("mahalluId") REFERENCES "app_private"."Mahallu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Household" ADD CONSTRAINT "Household_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Roles and permissions
INSERT INTO "app_private"."Permission" ("name") VALUES ('mahallu.manage');
INSERT INTO "app_private"."RolePermission" ("roleName", "permissionName") VALUES ('ADMIN', 'mahallu.manage');

COMMIT;
