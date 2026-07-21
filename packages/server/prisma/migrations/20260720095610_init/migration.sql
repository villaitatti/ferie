-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('FERIE_FINAL_APPROVER', 'FERIE_PORTAL_ADMIN', 'STAFF_IT');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('PRE_APPROVER', 'RESPONSABILE', 'SUBSTITUTE_RESPONSABILE');

-- CreateEnum
CREATE TYPE "DurationMode" AS ENUM ('FULL_DAY_RANGE', 'MINUTES_SINGLE_DAY');

-- CreateEnum
CREATE TYPE "EntryMode" AS ENUM ('SELF_SERVICE', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('STANDARD', 'SENSITIVE');

-- CreateEnum
CREATE TYPE "CalendarVisibility" AS ENUM ('EXACT', 'GENERIC', 'HIDDEN');

-- CreateEnum
CREATE TYPE "BalanceUnit" AS ENUM ('DAYS', 'MINUTES');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PENDING_FINAL_APPROVAL', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'CHANGE_REQUESTED', 'CANCELLATION_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestProvenance" AS ENUM ('SELF_SERVICE', 'ADMIN_MANUAL', 'EXTERNAL_IMPORT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('UNRECONCILED', 'MATCHED', 'DISCREPANCY', 'RESOLVED');

-- CreateEnum
CREATE TYPE "HolidayKind" AS ENUM ('NATIONAL', 'LOCAL', 'CENTRE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HolidayRecurrence" AS ENUM ('FIXED_ANNUAL', 'EASTER_OFFSET', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('SUBMIT', 'APPROVE', 'DECLINE', 'ESCALATE', 'WITHDRAW', 'REQUEST_CHANGE', 'REQUEST_CANCELLATION', 'CANCEL');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'COMMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "DepartmentMirror" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMirror" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "auth0Subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "departmentId" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "fte" DECIMAL(5,4) NOT NULL,
    "schedule" JSONB NOT NULL,
    "roles" "AppRole"[],
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeMirror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApproverAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "role" "ApprovalRole" NOT NULL,

    CONSTRAINT "ApproverAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorySyncRun" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "DirectorySyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelIt" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "unit" "BalanceUnit" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BalanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelIt" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "durationMode" "DurationMode" NOT NULL,
    "entryMode" "EntryMode" NOT NULL,
    "sensitivity" "Sensitivity" NOT NULL DEFAULT 'STANDARD',
    "balanceAccountId" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "employeeVisibility" "CalendarVisibility" NOT NULL DEFAULT 'EXACT',
    "departmentVisibility" "CalendarVisibility" NOT NULL DEFAULT 'EXACT',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AbsenceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "absenceTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "BalanceUnit" NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "provenance" "RequestProvenance" NOT NULL,
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "overBalance" BOOLEAN NOT NULL DEFAULT false,
    "employeeSnapshot" JSONB NOT NULL,
    "calculationSnapshot" JSONB NOT NULL,
    "parentRequestId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestSegment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" "BalanceUnit" NOT NULL,
    "exclusionReason" TEXT,

    CONSTRAINT "RequestSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestBalanceAllocation" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "RequestBalanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorSubject" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "fromStatus" "WorkflowStatus",
    "toStatus" "WorkflowStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelIt" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "kind" "HolidayKind" NOT NULL,
    "recurrence" "HolidayRecurrence" NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "easterOffset" INTEGER,
    "oneOffDate" DATE,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "deductsLeave" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "cutoffDate" DATE NOT NULL,
    "status" "ImportStatus" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "employeeId" TEXT,
    "accountCode" TEXT NOT NULL,
    "accountId" TEXT,
    "amount" DECIMAL(10,2),
    "asOf" DATE,
    "errorCode" TEXT,

    CONSTRAINT "ImportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "asOf" DATE NOT NULL,
    "cutoffDate" DATE NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualBalanceAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationCase" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "status" "ReconciliationStatus" NOT NULL,
    "externalReference" TEXT,
    "expectedAmount" DECIMAL(10,2),
    "actualAmount" DECIMAL(10,2),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorSubject" TEXT NOT NULL,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMirror_sourceId_key" ON "DepartmentMirror"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMirror_sourceId_key" ON "EmployeeMirror"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMirror_employeeNumber_key" ON "EmployeeMirror"("employeeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMirror_auth0Subject_key" ON "EmployeeMirror"("auth0Subject");

-- CreateIndex
CREATE UNIQUE INDEX "ApproverAssignment_employeeId_approverId_role_key" ON "ApproverAssignment"("employeeId", "approverId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceAccount_code_key" ON "BalanceAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceType_code_key" ON "AbsenceType"("code");

-- CreateIndex
CREATE INDEX "AbsenceRequest_employeeId_status_idx" ON "AbsenceRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "AbsenceRequest_startDate_endDate_idx" ON "AbsenceRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "RequestSegment_requestId_date_idx" ON "RequestSegment"("requestId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayRule_code_key" ON "HolidayRule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_checksum_key" ON "ImportBatch"("checksum");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_employeeId_accountId_asOf_idx" ON "BalanceSnapshot"("employeeId", "accountId", "asOf");

-- CreateIndex
CREATE INDEX "ManualBalanceAdjustment_employeeId_accountId_effectiveDate_idx" ON "ManualBalanceAdjustment"("employeeId", "accountId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "EmployeeMirror" ADD CONSTRAINT "EmployeeMirror_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentMirror"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApproverAssignment" ADD CONSTRAINT "ApproverAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMirror"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApproverAssignment" ADD CONSTRAINT "ApproverAssignment_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "EmployeeMirror"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceType" ADD CONSTRAINT "AbsenceType_balanceAccountId_fkey" FOREIGN KEY ("balanceAccountId") REFERENCES "BalanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMirror"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_absenceTypeId_fkey" FOREIGN KEY ("absenceTypeId") REFERENCES "AbsenceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsenceRequest" ADD CONSTRAINT "AbsenceRequest_parentRequestId_fkey" FOREIGN KEY ("parentRequestId") REFERENCES "AbsenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestSegment" ADD CONSTRAINT "RequestSegment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AbsenceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestBalanceAllocation" ADD CONSTRAINT "RequestBalanceAllocation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AbsenceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestBalanceAllocation" ADD CONSTRAINT "RequestBalanceAllocation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BalanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAction" ADD CONSTRAINT "ApprovalAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AbsenceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLine" ADD CONSTRAINT "ImportLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLine" ADD CONSTRAINT "ImportLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMirror"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLine" ADD CONSTRAINT "ImportLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BalanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMirror"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BalanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBalanceAdjustment" ADD CONSTRAINT "ManualBalanceAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeMirror"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualBalanceAdjustment" ADD CONSTRAINT "ManualBalanceAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BalanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AbsenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
