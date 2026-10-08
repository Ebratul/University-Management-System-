-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('THEORY', 'PRACTICAL', 'PROJECT', 'THESIS', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "course_offerings" ADD COLUMN     "registrationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "semesterLevel" INTEGER;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "courseType" "CourseType" NOT NULL DEFAULT 'THEORY',
ADD COLUMN     "prerequisiteId" TEXT,
ALTER COLUMN "credits" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "registrationInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "currentSemesterLevel" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "registration_settings" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "theoryRate" INTEGER NOT NULL DEFAULT 0,
    "practicalRate" INTEGER NOT NULL DEFAULT 0,
    "otherRate" INTEGER NOT NULL DEFAULT 0,
    "registrationFee" INTEGER NOT NULL DEFAULT 0,
    "minCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxCredits" DOUBLE PRECISION NOT NULL DEFAULT 24,
    "registrationStart" TIMESTAMP(3),
    "registrationEnd" TIMESTAMP(3),
    "lateEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lateStart" TIMESTAMP(3),
    "lateEnd" TIMESTAMP(3),
    "lateFee" INTEGER NOT NULL DEFAULT 0,
    "invoiceValidityHours" INTEGER NOT NULL DEFAULT 72,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_registrations" (
    "id" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "theoryCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "practicalCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_registration_items" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "courseType" "CourseType" NOT NULL,
    "credits" DOUBLE PRECISION NOT NULL,
    "rate" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "course_registration_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "registrationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "theoryCredits" DOUBLE PRECISION NOT NULL,
    "practicalCredits" DOUBLE PRECISION NOT NULL,
    "otherCredits" DOUBLE PRECISION NOT NULL,
    "totalCredits" DOUBLE PRECISION NOT NULL,
    "theoryRate" INTEGER NOT NULL,
    "practicalRate" INTEGER NOT NULL,
    "otherRate" INTEGER NOT NULL,
    "theoryFee" INTEGER NOT NULL,
    "practicalFee" INTEGER NOT NULL,
    "otherFee" INTEGER NOT NULL,
    "registrationFee" INTEGER NOT NULL,
    "lateFee" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_settings_semesterId_key" ON "registration_settings"("semesterId");

-- CreateIndex
CREATE UNIQUE INDEX "course_registrations_registrationNo_key" ON "course_registrations"("registrationNo");

-- CreateIndex
CREATE INDEX "course_registrations_studentId_idx" ON "course_registrations"("studentId");

-- CreateIndex
CREATE INDEX "course_registrations_semesterId_status_idx" ON "course_registrations"("semesterId", "status");

-- CreateIndex
CREATE INDEX "course_registrations_status_idx" ON "course_registrations"("status");

-- CreateIndex
CREATE INDEX "course_registration_items_courseOfferingId_idx" ON "course_registration_items"("courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "course_registration_items_registrationId_courseOfferingId_key" ON "course_registration_items"("registrationId", "courseOfferingId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_invoices_invoiceNo_key" ON "registration_invoices"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "registration_invoices_registrationId_key" ON "registration_invoices"("registrationId");

-- CreateIndex
CREATE INDEX "registration_invoices_studentId_idx" ON "registration_invoices"("studentId");

-- CreateIndex
CREATE INDEX "registration_invoices_semesterId_idx" ON "registration_invoices"("semesterId");

-- CreateIndex
CREATE INDEX "registration_invoices_status_expiresAt_idx" ON "registration_invoices"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "payments_registrationInvoiceId_idx" ON "payments"("registrationInvoiceId");

-- AddForeignKey
ALTER TABLE "registration_settings" ADD CONSTRAINT "registration_settings_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_registrations" ADD CONSTRAINT "course_registrations_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_registration_items" ADD CONSTRAINT "course_registration_items_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_registration_items" ADD CONSTRAINT "course_registration_items_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_invoices" ADD CONSTRAINT "registration_invoices_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "course_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_invoices" ADD CONSTRAINT "registration_invoices_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_invoices" ADD CONSTRAINT "registration_invoices_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_registrationInvoiceId_fkey" FOREIGN KEY ("registrationInvoiceId") REFERENCES "registration_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A student may have only ONE live registration per semester. Cancelled,
-- rejected and expired ones do not count, so a student can register again.
-- Prisma cannot express a partial unique index in schema.prisma; use
-- `prisma migrate deploy` (not `migrate dev`) so it is not "corrected" away.
CREATE UNIQUE INDEX "course_registrations_live_student_semester_key"
  ON "course_registrations"("studentId", "semesterId")
  WHERE "status" IN ('SUBMITTED', 'PAYMENT_PENDING', 'PAID', 'CONFIRMED');
