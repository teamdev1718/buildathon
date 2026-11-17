BEGIN;

-- CreateEnum
CREATE TYPE "app_private"."ExpenseCategory" AS ENUM ('ANIMALS', 'TRANSPORT', 'LABOUR', 'PACKING', 'FOOD', 'OTHER');

-- CreateTable
CREATE TABLE "app_private"."InboxItem" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_private"."Expense" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "app_private"."ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_key_key" ON "app_private"."InboxItem"("key");

-- CreateIndex
CREATE INDEX "InboxItem_userId_createdAt_idx" ON "app_private"."InboxItem"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_programId_spentOn_idx" ON "app_private"."Expense"("programId", "spentOn");

-- AddForeignKey
ALTER TABLE "app_private"."InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_private"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_private"."Expense" ADD CONSTRAINT "Expense_programId_fkey" FOREIGN KEY ("programId") REFERENCES "app_private"."Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
