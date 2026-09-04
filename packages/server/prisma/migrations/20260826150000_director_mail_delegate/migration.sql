-- AlterTable
ALTER TABLE "EmployeeMirror" ADD COLUMN "isDirector" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "directorMailDelegateSourceId" TEXT;

-- AlterTable
ALTER TABLE "NotificationOutbox" ADD COLUMN "suppressedAt" TIMESTAMP(3);
