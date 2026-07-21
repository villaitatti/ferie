import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { readSheet } from "read-excel-file/node";
import { asyncHandler, HttpError } from "./lib/http.js";
import {
  commitBalanceImport,
  createBalanceAdjustment,
  createSensitiveAbsence,
  decideRequest,
  getMe,
  importFutureAbsences,
  listAdminData,
  listApprovals,
  listCalendar,
  listHolidayRules,
  listMyRequests,
  listRequestCalendar,
  previewBalanceImport,
  previewRequest,
  resolveReconciliation,
  submitRequest,
  upsertHolidayRule,
  updateAbsenceTypeVisibility,
  withdrawOrCancel,
  assertCurrentRole,
} from "./services/portal.js";
import { integrationHealth, syncDirectory } from "./services/directory.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const api = Router();

async function tabularRows(file: Express.Multer.File): Promise<Array<Record<string, unknown>>> {
  if (file.originalname.toLowerCase().endsWith(".csv")) {
    return parse(file.buffer, { columns: true, bom: true, skip_empty_lines: true, trim: true }) as Array<Record<string, unknown>>;
  }
  const sheet = await readSheet(file.buffer);
  const headers = sheet[0]?.map((cell) => String(cell ?? "").trim()) ?? [];
  return sheet.slice(1).filter((row) => row.some((cell) => cell !== null)).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

api.get("/health", (_request, response) => response.json({ status: "ok", service: "ferie-portal" }));
api.get("/me", asyncHandler(async (request, response) => response.json(await getMe(request))));
api.get("/requests", asyncHandler(async (request, response) => response.json(await listMyRequests(request))));
api.get("/request-calendar", asyncHandler(async (request, response) => response.json(await listRequestCalendar(request, request.query))));
api.post("/requests/preview", asyncHandler(async (request, response) => response.json(await previewRequest(request, request.body))));
api.post("/requests", asyncHandler(async (request, response) => response.status(201).json(await submitRequest(request, request.body))));
api.post("/requests/:id/decision", asyncHandler(async (request, response) => response.json(await decideRequest(request, String(request.params.id), request.body))));
api.post("/requests/:id/withdraw", asyncHandler(async (request, response) => response.json(await withdrawOrCancel(request, String(request.params.id)))));
api.get("/approvals", asyncHandler(async (request, response) => response.json(await listApprovals(request))));
api.get("/calendars/:scope", asyncHandler(async (request, response) => {
  const scope = request.params.scope;
  if (scope !== "personal" && scope !== "department") throw new HttpError(400, "INVALID_CALENDAR_SCOPE");
  const now = new Date();
  const from = String(request.query.from ?? `${now.getFullYear()}-01-01`);
  const to = String(request.query.to ?? `${now.getFullYear()}-12-31`);
  response.json(await listCalendar(request, scope, from, to));
}));
api.post("/admin/sensitive-absences", asyncHandler(async (request, response) => response.status(201).json(await createSensitiveAbsence(request, request.body))));
api.get("/admin", asyncHandler(async (request, response) => response.json(await listAdminData(request))));
api.patch("/admin/absence-types/:id/visibility", asyncHandler(async (request, response) => response.json(await updateAbsenceTypeVisibility(request, String(request.params.id), request.body))));
api.get("/admin/holidays", asyncHandler(async (request, response) => response.json(await listHolidayRules(request))));
api.put("/admin/holidays", asyncHandler(async (request, response) => response.json(await upsertHolidayRule(request, request.body))));
api.post("/admin/balance-imports/preview", asyncHandler(async (request, response) => response.json(await previewBalanceImport(request, request.body))));
api.post("/admin/balance-imports", asyncHandler(async (request, response) => response.status(201).json(await commitBalanceImport(request, request.body))));
api.post("/admin/balance-adjustments", asyncHandler(async (request, response) => response.status(201).json(await createBalanceAdjustment(request, request.body))));
api.post("/admin/future-absence-imports", asyncHandler(async (request, response) => response.status(201).json(await importFutureAbsences(request, request.body))));
api.post("/admin/future-absence-imports/file", upload.single("file"), asyncHandler(async (request, response) => {
  if (!request.file) throw new HttpError(400, "FILE_REQUIRED");
  const sourceRows = await tabularRows(request.file);
  if (!sourceRows.length) throw new HttpError(400, "EMPTY_WORKBOOK");
  const grouped = new Map<string, Record<string, unknown> & { allocations: Array<{ accountCode: string; amount: number }> }>();
  sourceRows.forEach((row, index) => {
    const externalReference = String(row.externalReference ?? row["Riferimento"] ?? "").trim();
    const key = externalReference || `row-${index + 1}`;
    const existing = grouped.get(key) ?? {
      employeeNumber: String(row.employeeNumber ?? row["Matricola"] ?? "").trim(),
      absenceTypeCode: String(row.absenceTypeCode ?? row["Tipologia"] ?? "").trim().toUpperCase(),
      startDate: String(row.startDate ?? row["Data inizio"] ?? "").slice(0, 10),
      endDate: String(row.endDate ?? row["Data fine"] ?? "").slice(0, 10),
      startTime: String(row.startTime ?? row["Ora inizio"] ?? "").trim() || undefined,
      endTime: String(row.endTime ?? row["Ora fine"] ?? "").trim() || undefined,
      externalReference: externalReference || undefined,
      allocations: [],
    };
    const accountCode = String(row.accountCode ?? row["Conto"] ?? "").trim().toUpperCase();
    if (accountCode) existing.allocations.push({ accountCode, amount: Number(row.amount ?? row["Quantità"]) });
    grouped.set(key, existing);
  });
  response.status(201).json(await importFutureAbsences(request, { sourceName: request.file.originalname, rows: [...grouped.values()] }));
}));
api.post("/admin/reconciliations/:id/resolve", asyncHandler(async (request, response) => response.json(await resolveReconciliation(request, String(request.params.id), request.body))));
api.post("/admin/balance-imports/file/preview", upload.single("file"), asyncHandler(async (request, response) => {
  if (!request.file) throw new HttpError(400, "FILE_REQUIRED");
  const sourceRows = await tabularRows(request.file);
  if (!sourceRows.length) throw new HttpError(400, "EMPTY_WORKBOOK");
  const rows = sourceRows.map((row) => ({
    employeeNumber: String(row.employeeNumber ?? row["Matricola"] ?? "").trim(),
    accountCode: String(row.accountCode ?? row["Conto"] ?? "").trim().toUpperCase(),
    amount: Number(row.amount ?? row["Saldo"]),
    asOf: String(row.asOf ?? row["Data saldo"] ?? "").slice(0, 10),
  }));
  response.json(await previewBalanceImport(request, { sourceName: request.file.originalname, cutoffDate: String(request.body.cutoffDate), rows }));
}));
api.get("/it/integrations", asyncHandler(async (request, response) => { await assertCurrentRole(request, ["STAFF_IT", "FERIE_PORTAL_ADMIN"]); response.json(await integrationHealth()); }));
api.post("/it/directory-sync", asyncHandler(async (request, response) => { await assertCurrentRole(request, ["STAFF_IT", "FERIE_PORTAL_ADMIN"]); response.status(202).json(await syncDirectory()); }));
