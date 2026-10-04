-- Unique values only have to be unique among live rows. These plain unique
-- constraints blocked reuse of a soft-deleted user's email, or a deleted
-- department's name or code. Each one is replaced by a partial unique index
-- that only covers rows where "deletedAt" IS NULL.
--
-- Prisma cannot express a partial index in schema.prisma, so the schema keeps
-- @unique for typing and `prisma migrate dev` will report this as drift. Use
-- `prisma migrate deploy` for these databases, and do not let migrate dev
-- recreate the full constraints.

-- users.email
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email") WHERE "deletedAt" IS NULL;

-- departments.name
DROP INDEX "departments_name_key";
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name") WHERE "deletedAt" IS NULL;

-- departments.code
DROP INDEX "departments_code_key";
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code") WHERE "deletedAt" IS NULL;

-- courses.courseCode
DROP INDEX "courses_courseCode_key";
CREATE UNIQUE INDEX "courses_courseCode_key" ON "courses"("courseCode") WHERE "deletedAt" IS NULL;

-- semesters.code
DROP INDEX "semesters_code_key";
CREATE UNIQUE INDEX "semesters_code_key" ON "semesters"("code") WHERE "deletedAt" IS NULL;
