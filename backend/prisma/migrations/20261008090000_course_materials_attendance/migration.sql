-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- Student registration number. Existing students are backfilled with their
-- generated student id so the column can be NOT NULL.
ALTER TABLE "students" ADD COLUMN "registrationNumber" TEXT;
UPDATE "students" SET "registrationNumber" = "studentId";
ALTER TABLE "students" ALTER COLUMN "registrationNumber" SET NOT NULL;
-- Partial unique index (live rows only), same convention as
-- 20261004120000_partial_unique_for_soft_deleted_rows. schema.prisma keeps
-- @unique for typing; use `prisma migrate deploy`, not `migrate dev`.
CREATE UNIQUE INDEX "students_registrationNumber_key" ON "students"("registrationNumber") WHERE "deletedAt" IS NULL;

-- Course description
ALTER TABLE "courses" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "course_materials" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "publicId" TEXT NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "courseOfferingId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "markedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_materials_courseOfferingId_idx" ON "course_materials"("courseOfferingId");
CREATE INDEX "course_materials_uploadedById_idx" ON "course_materials"("uploadedById");
CREATE INDEX "attendances_studentId_idx" ON "attendances"("studentId");
CREATE INDEX "attendances_courseOfferingId_date_idx" ON "attendances"("courseOfferingId", "date");
CREATE UNIQUE INDEX "attendances_courseOfferingId_studentId_date_key" ON "attendances"("courseOfferingId", "studentId", "date");

-- AddForeignKey
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "course_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
