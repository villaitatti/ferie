-- CreateEnum
CREATE TYPE "Language" AS ENUM ('IT', 'EN');

-- AlterTable
ALTER TABLE "EmployeeMirror" ADD COLUMN     "preferredLanguage" "Language" NOT NULL DEFAULT 'IT';
