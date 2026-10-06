-- CreateTable
CREATE TABLE "website_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "universityName" TEXT NOT NULL DEFAULT 'University Management System',
    "tagline" TEXT NOT NULL DEFAULT 'Excellence in education, research and service.',
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "homepageBackgroundUrl" TEXT,
    "homepageBackgroundPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the single global row so the public site always has settings.
INSERT INTO "website_settings" ("id", "updatedAt") VALUES ('global', CURRENT_TIMESTAMP);
