import { Temporal } from "@js-temporal/polyfill";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, FileSpreadsheet, History, LockKeyhole, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api, ApiError } from "../api";
import { PageHeading, PanelTitle } from "../components";
import { formatPortalDateTime } from "../request-calendar";
import { cn } from "@/lib/utils";
import { toneSoft } from "@/lib/tone";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ComboboxField } from "@/components/ui/combobox-field";
import { DateField } from "@/components/ui/date-field";
import { FileField } from "@/components/ui/file-field";
import { NumberField } from "@/components/ui/number-field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SelectField } from "@/components/ui/select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextField, TextareaField } from "@/components/ui/text-field";

interface AdminData {
  employees: Array<{ id: string; employeeNumber: string; displayName: string; departmentName: string }>;
  imports: Array<{ id: string; sourceName: string; rowCount: number; createdAt: string; status: string }>;
  reconciliation: Array<{ id: string; status: string; externalReference: string | null }>;
  audit: Array<{ id: string; action: string; entityType: string; actorSubject: string; createdAt: string }>;
  absenceTypes: Array<{ id: string; code: string; labelIt: string; labelEn: string; departmentVisibility: "EXACT" | "GENERIC" | "HIDDEN"; sensitivity: string }>;
}
interface Holiday { id: string; code: string; labelIt: string; labelEn: string; kind: string; recurrence: string; active: boolean }
interface ImportPreview { input: unknown; checksum: string; duplicateBatchId: string | null; validCount: number; errorCount: number; rows: Array<{ rowNumber: number; employeeNumber: string; accountCode: string; amount: number; errors: string[] }> }
interface FutureImportError { rowNumber: number; code: string; conflictingRowNumber?: number }

export function Admin() {
  const { t, i18n } = useTranslation();
  const english = i18n.language === "en";
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["admin"], queryFn: () => api<AdminData>("/admin") });
  const holidays = useQuery({ queryKey: ["holidays"], queryFn: () => api<Holiday[]>("/admin/holidays") });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [absenceTypeCode, setAbsenceTypeCode] = useState("MALATTIA");
  const today = Temporal.Now.plainDateISO("Europe/Rome").toString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [futureFile, setFutureFile] = useState<File | null>(null);
  const [futureErrors, setFutureErrors] = useState<FutureImportError[]>([]);
  const [cutoff, setCutoff] = useState(today);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [holiday, setHoliday] = useState({ code: "", labelIt: "", labelEn: "", oneOffDate: today });
  const [adjustment, setAdjustment] = useState({ employeeId: "", accountCode: "FERIE", amount: 0 as number | null, effectiveDate: today, reason: "" });
  const [resolution, setResolution] = useState({ id: "", text: "" });
  const sensitive = useMutation({
    mutationFn: () => api("/admin/sensitive-absences", { method: "POST", body: JSON.stringify({ employeeId, absenceTypeCode, startDate, endDate }) }),
    onSuccess: async () => { toast.success(t("recordCreated")); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const previewFile = useMutation({
    mutationFn: async () => { const form = new FormData(); if (file) form.append("file", file); form.append("cutoffDate", cutoff); return api<ImportPreview>("/admin/balance-imports/file/preview", { method: "POST", body: form }); },
    onSuccess: setPreview,
    onError: (error: Error) => toast.error(error.message),
  });
  const commit = useMutation({
    mutationFn: () => api("/admin/balance-imports", { method: "POST", body: JSON.stringify(preview?.input) }),
    onSuccess: async () => { toast.success(english ? "Import committed" : "Importazione completata"); setPreview(null); setFile(null); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const importFuture = useMutation({
    mutationFn: async () => { const form = new FormData(); if (futureFile) form.append("file", futureFile); return api<{ createdIds: string[]; errors: unknown[] }>("/admin/future-absence-imports/file", { method: "POST", body: form }); },
    onMutate: () => setFutureErrors([]),
    onSuccess: async (result) => { toast.success(english ? `${result.createdIds.length} records imported` : `${result.createdIds.length} assenze importate`); setFutureErrors([]); setFutureFile(null); await queryClient.invalidateQueries(); },
    onError: (error: Error) => {
      const details = error instanceof ApiError && typeof error.details === "object" && error.details !== null ? error.details as { errors?: FutureImportError[] } : undefined;
      setFutureErrors(details?.errors ?? []);
      toast.error(english ? "The file contains errors. Nothing was imported." : "Il file contiene errori. Nessuna assenza è stata importata.");
    },
  });
  const adjust = useMutation({
    mutationFn: () => api("/admin/balance-adjustments", { method: "POST", body: JSON.stringify({ ...adjustment, amount: Number(adjustment.amount) }) }),
    onSuccess: async () => { toast.success(english ? "Adjustment recorded" : "Rettifica registrata"); setAdjustment({ employeeId: "", accountCode: "FERIE", amount: 0, effectiveDate: today, reason: "" }); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolve = useMutation({
    mutationFn: () => api(`/admin/reconciliations/${resolution.id}/resolve`, { method: "POST", body: JSON.stringify({ resolution: resolution.text }) }),
    onSuccess: async () => { toast.success(english ? "Case resolved" : "Caso risolto"); setResolution({ id: "", text: "" }); await queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveHoliday = useMutation({
    mutationFn: () => api("/admin/holidays", { method: "PUT", body: JSON.stringify({ ...holiday, kind: "CUSTOM", recurrence: "ONE_OFF", active: true }) }),
    onSuccess: async () => { toast.success(english ? "Closure saved" : "Chiusura salvata"); setHoliday({ code: "", labelIt: "", labelEn: "", oneOffDate: today }); await queryClient.invalidateQueries({ queryKey: ["holidays"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateVisibility = useMutation({
    mutationFn: ({ id, departmentVisibility }: { id: string; departmentVisibility: string }) => api(`/admin/absence-types/${id}/visibility`, { method: "PATCH", body: JSON.stringify({ departmentVisibility }) }),
    onSuccess: async () => { toast.success(english ? "Calendar visibility updated" : "Visibilità calendario aggiornata"); await queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  const employeeOptions = data.data?.employees.map((entry) => ({ value: entry.id, label: `${entry.displayName} · ${entry.departmentName}` })) ?? [];

  return <div className="flex flex-col gap-6">
    <PageHeading eyebrow="HR operations" title={t("administration")} />

    <Tabs defaultValue="sensitive">
      {/* h-auto needs the important flag: the list's h-9 is variant-scoped and outweighs plain
          utilities, so a wrapped second row would otherwise overflow under the active panel. */}
      <TabsList className="h-auto! flex-wrap">
        <TabsTrigger value="sensitive"><LockKeyhole className="size-4" />{t("sensitiveEntry")}</TabsTrigger>
        <TabsTrigger value="balances"><FileSpreadsheet className="size-4" />{t("balanceImport")}</TabsTrigger>
        <TabsTrigger value="reconciliation"><RefreshCw className="size-4" />{english ? "Reconciliation" : "Riconciliazione"}</TabsTrigger>
        <TabsTrigger value="holidays"><CalendarPlus className="size-4" />{t("holidayRules")}</TabsTrigger>
        <TabsTrigger value="audit"><History className="size-4" />{t("audit")}</TabsTrigger>
      </TabsList>

      <TabsContent value="sensitive" className="mt-6 flex flex-col gap-4">
        <Card className="max-w-[760px] gap-4 p-6">
          <Alert className={cn(toneSoft.blue)}>
            <AlertDescription className="text-current">{english ? "Dates only. Do not enter diagnoses or medical notes." : "Solo date. Non inserire diagnosi o dettagli medici."}</AlertDescription>
          </Alert>
          <ComboboxField label={t("employee")} value={employeeId} onChange={setEmployeeId} data={employeeOptions} placeholder={t("employee")} emptyMessage={t("noIdentityMatches")} />
          <SelectField
            label={t("type")}
            value={absenceTypeCode}
            onChange={setAbsenceTypeCode}
            data={[
              { value: "MALATTIA", label: english ? "Sick leave" : "Malattia" },
              { value: "LEGGE_104", label: "Legge 104" },
              { value: "CONGEDO_PARENTALE", label: english ? "Parental leave" : "Congedo parentale" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label={t("startDate")} value={startDate} onChange={setStartDate} />
            <DateField label={t("endDate")} value={endDate} onChange={setEndDate} minDate={startDate} />
          </div>
          <div className="flex justify-end">
            <Button disabled={!employeeId} loading={sensitive.isPending} onClick={() => sensitive.mutate()}>{t("save")}</Button>
          </div>
        </Card>

        <Card className="max-w-[760px] gap-0 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{english ? "Department calendar" : "Calendario del reparto"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data?.absenceTypes.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {english ? entry.labelEn : entry.labelIt}
                    {entry.sensitivity === "SENSITIVE" && <Badge variant="ghost" className={cn("ml-2", toneSoft.violet)}>Sensitive</Badge>}
                  </TableCell>
                  <TableCell>
                    <SelectField
                      size="sm"
                      aria-label={english ? "Department calendar" : "Calendario del reparto"}
                      value={entry.departmentVisibility}
                      onChange={(value) => updateVisibility.mutate({ id: entry.id, departmentVisibility: value })}
                      data={[
                        { value: "EXACT", label: english ? "Name + exact type" : "Nome + tipo esatto" },
                        { value: "GENERIC", label: english ? "Name + absent" : "Nome + assente" },
                        { value: "HIDDEN", label: english ? "Hidden" : "Nascosto" },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="balances" className="mt-6 flex flex-col gap-4">
        <Card className="gap-4 p-6">
          <PanelTitle>{english ? "Monthly balance file" : "File saldi mensile"}</PanelTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <FileField label={t("chooseFile")} placeholder={t("chooseFile")} accept=".csv,.xlsx,.xls" value={file} onChange={setFile} clearLabel={t("calendarClear")} />
            <DateField label={t("cutoff")} value={cutoff} onChange={setCutoff} />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" disabled={!file} loading={previewFile.isPending} onClick={() => previewFile.mutate()}>{t("importPreview")}</Button>
          </div>
        </Card>

        {preview && <Card className="gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="ghost" className={toneSoft.green}>{preview.validCount} {english ? "valid" : "valide"}</Badge>
              <Badge variant="ghost" className={preview.errorCount ? toneSoft.red : toneSoft.gray}>{preview.errorCount} {english ? "errors" : "errori"}</Badge>
              {preview.duplicateBatchId && <Badge variant="ghost" className={toneSoft.orange}>{english ? "Duplicate" : "Duplicato"}</Badge>}
            </div>
            <Button disabled={preview.errorCount > 0 || Boolean(preview.duplicateBatchId)} loading={commit.isPending} onClick={() => commit.mutate()}>{english ? "Commit" : "Conferma"}</Button>
          </div>
          <ScrollArea className="w-full">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{english ? "Validation" : "Verifica"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.slice(0, 25).map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell>{row.rowNumber}</TableCell>
                    <TableCell>{row.employeeNumber}</TableCell>
                    <TableCell>{row.accountCode}</TableCell>
                    <TableCell>{row.amount}</TableCell>
                    <TableCell>{row.errors.join(", ") || "OK"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>}

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card className="gap-4 p-6">
            <PanelTitle>{english ? "Approved future absences" : "Assenze future già approvate"}</PanelTitle>
            <FileField label={t("chooseFile")} placeholder={t("chooseFile")} accept=".csv,.xlsx,.xls" value={futureFile} onChange={(value) => { setFutureFile(value); setFutureErrors([]); }} clearLabel={t("calendarClear")} />
            {futureErrors.length > 0 && (
              <Alert className={cn(toneSoft.red)}>
                <AlertTitle>{english ? "File not imported" : "File non importato"}</AlertTitle>
                <AlertDescription className="text-current">
                  <div className="flex flex-col gap-1">
                    {futureErrors.slice(0, 8).map((error) => (
                      <span key={`${error.rowNumber}-${error.code}`} className="text-sm">
                        {english ? "Row" : "Riga"} {error.rowNumber}: {error.code}
                        {error.conflictingRowNumber ? ` (${english ? "conflicts with row" : "in conflitto con la riga"} ${error.conflictingRowNumber})` : ""}
                      </span>
                    ))}
                    {futureErrors.length > 8 && <span className="text-sm">+{futureErrors.length - 8} {english ? "more errors" : "altri errori"}</span>}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" disabled={!futureFile} loading={importFuture.isPending} onClick={() => importFuture.mutate()}>{english ? "Import" : "Importa"}</Button>
            </div>
          </Card>

          <Card className="gap-4 p-6">
            <PanelTitle>{english ? "Manual adjustment" : "Rettifica manuale"}</PanelTitle>
            <ComboboxField
              label={t("employee")}
              placeholder={t("employee")}
              emptyMessage={t("noIdentityMatches")}
              value={adjustment.employeeId || null}
              onChange={(value) => setAdjustment({ ...adjustment, employeeId: value })}
              data={data.data?.employees.map((entry) => ({ value: entry.id, label: entry.displayName })) ?? []}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Account" value={adjustment.accountCode} onChange={(value) => setAdjustment({ ...adjustment, accountCode: value })} data={["FERIE", "EX_FESTIVITA", "PERMESSO"]} />
              <NumberField label={t("amount")} value={adjustment.amount} onChange={(value) => setAdjustment({ ...adjustment, amount: value })} />
            </div>
            <DateField label={t("startDate")} value={adjustment.effectiveDate} onChange={(value) => setAdjustment({ ...adjustment, effectiveDate: value })} />
            <TextareaField label={english ? "Reason" : "Motivo"} value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.currentTarget.value })} />
            <div className="flex justify-end">
              <Button disabled={!adjustment.employeeId || !adjustment.amount || adjustment.reason.length < 3} loading={adjust.isPending} onClick={() => adjust.mutate()}>{t("save")}</Button>
            </div>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="reconciliation" className="mt-6 flex flex-col gap-4">
        {data.data?.reconciliation.length ? (
          <Card className="gap-0 overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{english ? "Reference" : "Riferimento"}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.reconciliation.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Badge variant="ghost" className={toneSoft[entry.status === "DISCREPANCY" ? "orange" : entry.status === "RESOLVED" || entry.status === "MATCHED" ? "green" : "gray"]}>{entry.status}</Badge>
                    </TableCell>
                    <TableCell>{entry.externalReference ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" disabled={entry.status === "RESOLVED"} onClick={() => setResolution({ id: entry.id, text: "" })}>{english ? "Resolve" : "Risolvi"}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : <p className="text-muted-foreground">{english ? "No reconciliation cases." : "Nessun caso di riconciliazione."}</p>}

        {resolution.id && <Card className="max-w-[680px] gap-4 p-6">
          <TextareaField label={english ? "Resolution" : "Risoluzione"} value={resolution.text} onChange={(event) => setResolution({ ...resolution, text: event.currentTarget.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResolution({ id: "", text: "" })}>{english ? "Cancel" : "Annulla"}</Button>
            <Button disabled={resolution.text.length < 3} loading={resolve.isPending} onClick={() => resolve.mutate()}>{t("save")}</Button>
          </div>
        </Card>}
      </TabsContent>

      <TabsContent value="holidays" className="mt-6 flex flex-col gap-4">
        <Card className="gap-4 p-6">
          <PanelTitle>{english ? "Add one-off closure" : "Aggiungi chiusura una tantum"}</PanelTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField label="Code" value={holiday.code} onChange={(event) => setHoliday({ ...holiday, code: event.currentTarget.value })} />
            <TextField label="Italiano" value={holiday.labelIt} onChange={(event) => setHoliday({ ...holiday, labelIt: event.currentTarget.value })} />
            <TextField label="English" value={holiday.labelEn} onChange={(event) => setHoliday({ ...holiday, labelEn: event.currentTarget.value })} />
            <DateField label={t("startDate")} value={holiday.oneOffDate} onChange={(value) => setHoliday({ ...holiday, oneOffDate: value })} />
          </div>
          <div className="flex justify-end">
            <Button disabled={!holiday.code.trim() || !holiday.labelIt.trim() || !holiday.labelEn.trim() || !holiday.oneOffDate} loading={saveHoliday.isPending} onClick={() => saveHoliday.mutate()}>{t("save")}</Button>
          </div>
        </Card>

        <Card className="gap-0 overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Italiano</TableHead>
                <TableHead>English</TableHead>
                <TableHead>Kind</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.data?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.code}</TableCell>
                  <TableCell>{entry.labelIt}</TableCell>
                  <TableCell>{entry.labelEn}</TableCell>
                  <TableCell><Badge variant="outline">{entry.kind}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="audit" className="mt-6">
        <Card className="gap-0 overflow-hidden p-0">
          <ScrollArea className="w-full">
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data?.audit.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatPortalDateTime(entry.createdAt, i18n.language)}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell>{entry.entityType}</TableCell>
                    <TableCell>{entry.actorSubject}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </TabsContent>
    </Tabs>
  </div>;
}
