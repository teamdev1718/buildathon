BEGIN;

-- AlterTable
ALTER TABLE "app_private"."Program" ADD COLUMN     "payByDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "app_private"."Booking" ADD COLUMN     "autopay" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "app_private"."ProgramPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "app_private"."PaymentMethod" NOT NULL,
    "status" "app_private"."PaymentStatus" NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "recordedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "ProgramPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramPayment_razorpayOrderId_key" ON "app_private"."ProgramPayment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramPayment_razorpayPaymentId_key" ON "app_private"."ProgramPayment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "ProgramPayment_bookingId_status_idx" ON "app_private"."ProgramPayment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "ProgramPayment_status_createdAt_idx" ON "app_private"."ProgramPayment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "app_private"."ProgramPayment" ADD CONSTRAINT "ProgramPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "app_private"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
