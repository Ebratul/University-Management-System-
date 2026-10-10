-- CreateTable
CREATE TABLE "universities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentDomain" TEXT NOT NULL,
    "teacherDomain" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id"),
    -- Domains are stored lower-case and the two roles can never share one.
    CONSTRAINT "universities_domains_lowercase" CHECK ("studentDomain" = lower("studentDomain") AND "teacherDomain" = lower("teacherDomain")),
    CONSTRAINT "universities_domains_differ" CHECK ("studentDomain" <> "teacherDomain")
);

-- AlterTable
ALTER TABLE "departments" ADD COLUMN "universityId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "universities_name_key" ON "universities"("name");
CREATE UNIQUE INDEX "universities_studentDomain_key" ON "universities"("studentDomain");
CREATE UNIQUE INDEX "universities_teacherDomain_key" ON "universities"("teacherDomain");
CREATE INDEX "departments_universityId_idx" ON "departments"("universityId");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
