import { Alert, Badge, Button, FileInput, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Table, Tabs, Text, Textarea, TextInput, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, FileSpreadsheet, History, LockKeyhole, RefreshCw, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../api";

interface AdminData {
  employees: Array<{ id: string; employeeNumber: string; displayName: string; departmentName: string }>;
  imports: Array<{ id: string; sourceName: string; rowCount: number; createdAt: string; status: string }>;
  reconciliation: Array<{ id: string; status: string; externalReference: string | null }>;
  audit: Array<{ id: string; action: string; entityType: string; actorSubject: string; createdAt: string }>;
  absenceTypes: Array<{ id: string; code: string; labelIt: string; labelEn: string; departmentVisibility: "EXACT" | "GENERIC" | "HIDDEN"; sensitivity: string }>;
}
interface Holiday { id: string; code: string; labelIt: string; labelEn: string; kind: string; recurrence: string; active: boolean }
interface ImportPreview { input: unknown; checksum: string; duplicateBatchId: string | null; validCount: number; errorCount: number; rows: Array<{ rowNumber: number; employeeNumber: string; accountCode: string; amount: number; errors: string[] }> }

export function Admin() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["admin"], queryFn: () => api<AdminData>("/admin") });
  const holidays = useQuery({ queryKey: ["holidays"], queryFn: () => api<Holiday[]>("/admin/holidays") });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [absenceTypeCode, setAbsenceTypeCode] = useState("MALATTIA");
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [futureFile, setFutureFile] = useState<File | null>(null);
  const [cutoff, setCutoff] = useState(today);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [holiday, setHoliday] = useState({ code: "", labelIt: "", labelEn: "", oneOffDate: today });
  const [adjustment, setAdjustment] = useState({ employeeId: "", accountCode: "FERIE", amount: 0 as number | string, effectiveDate: today, reason: "" });
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
    onSuccess: async () => { toast.success(i18n.language === "en" ? "Import committed" : "Importazione completata"); setPreview(null); setFile(null); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const importFuture = useMutation({
    mutationFn: async () => { const form = new FormData(); if (futureFile) form.append("file", futureFile); return api<{ createdIds: string[]; errors: unknown[] }>("/admin/future-absence-imports/file", { method: "POST", body: form }); },
    onSuccess: async (result) => { toast.success(i18n.language === "en" ? `${result.createdIds.length} records imported` : `${result.createdIds.length} assenze importate`); setFutureFile(null); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const adjust = useMutation({
    mutationFn: () => api("/admin/balance-adjustments", { method: "POST", body: JSON.stringify({ ...adjustment, amount: Number(adjustment.amount) }) }),
    onSuccess: async () => { toast.success(i18n.language === "en" ? "Adjustment recorded" : "Rettifica registrata"); setAdjustment({ employeeId: "", accountCode: "FERIE", amount: 0, effectiveDate: today, reason: "" }); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolve = useMutation({
    mutationFn: () => api(`/admin/reconciliations/${resolution.id}/resolve`, { method: "POST", body: JSON.stringify({ resolution: resolution.text }) }),
    onSuccess: async () => { toast.success(i18n.language === "en" ? "Case resolved" : "Caso risolto"); setResolution({ id: "", text: "" }); await queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveHoliday = useMutation({
    mutationFn: () => api("/admin/holidays", { method: "PUT", body: JSON.stringify({ ...holiday, kind: "CUSTOM", recurrence: "ONE_OFF", active: true }) }),
    onSuccess: async () => { toast.success(i18n.language === "en" ? "Closure saved" : "Chiusura salvata"); setHoliday({ code: "", labelIt: "", labelEn: "", oneOffDate: today }); await queryClient.invalidateQueries({ queryKey: ["holidays"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateVisibility = useMutation({
    mutationFn: ({ id, departmentVisibility }: { id: string; departmentVisibility: string }) => api(`/admin/absence-types/${id}/visibility`, { method: "PATCH", body: JSON.stringify({ departmentVisibility }) }),
    onSuccess: async () => { toast.success(i18n.language === "en" ? "Calendar visibility updated" : "Visibilità calendario aggiornata"); await queryClient.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <Stack gap="lg"><div><Text size="sm" c="dimmed">HR operations</Text><Title order={1}>{t("administration")}</Title></div>
    <Tabs defaultValue="sensitive">
      <Tabs.List><Tabs.Tab value="sensitive" leftSection={<LockKeyhole size={16} />}>{t("sensitiveEntry")}</Tabs.Tab><Tabs.Tab value="balances" leftSection={<FileSpreadsheet size={16} />}>{t("balanceImport")}</Tabs.Tab><Tabs.Tab value="reconciliation" leftSection={<RefreshCw size={16} />}>{i18n.language === "en" ? "Reconciliation" : "Riconciliazione"}</Tabs.Tab><Tabs.Tab value="holidays" leftSection={<CalendarPlus size={16} />}>{t("holidayRules")}</Tabs.Tab><Tabs.Tab value="audit" leftSection={<History size={16} />}>{t("audit")}</Tabs.Tab></Tabs.List>
      <Tabs.Panel value="sensitive" pt="lg"><Stack><Paper className="tool-panel" withBorder p="lg" maw={760}><Stack><Alert color="blue">{i18n.language === "en" ? "Dates only. Do not enter diagnoses or medical notes." : "Solo date. Non inserire diagnosi o dettagli medici."}</Alert><Select searchable label={t("employee")} value={employeeId} onChange={setEmployeeId} data={data.data?.employees.map((entry) => ({ value: entry.id, label: `${entry.displayName} · ${entry.departmentName}` })) ?? []} /><Select label={t("type")} value={absenceTypeCode} onChange={(value) => setAbsenceTypeCode(value ?? "MALATTIA")} data={[{ value: "MALATTIA", label: i18n.language === "en" ? "Sick leave" : "Malattia" }, { value: "LEGGE_104", label: "Legge 104" }, { value: "CONGEDO_PARENTALE", label: i18n.language === "en" ? "Parental leave" : "Congedo parentale" }]} /><SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput type="date" label={t("startDate")} value={startDate} onChange={(event) => setStartDate(event.currentTarget.value)} /><TextInput type="date" min={startDate} label={t("endDate")} value={endDate} onChange={(event) => setEndDate(event.currentTarget.value)} /></SimpleGrid><Group justify="flex-end"><Button onClick={() => sensitive.mutate()} disabled={!employeeId} loading={sensitive.isPending}>{t("save")}</Button></Group></Stack></Paper><Paper withBorder maw={760}><Table><Table.Thead><Table.Tr><Table.Th>{t("type")}</Table.Th><Table.Th>{i18n.language === "en" ? "Department calendar" : "Calendario del reparto"}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.data?.absenceTypes.map((entry) => <Table.Tr key={entry.id}><Table.Td>{i18n.language === "en" ? entry.labelEn : entry.labelIt}{entry.sensitivity === "SENSITIVE" && <Badge ml="xs" color="grape" variant="light">Sensitive</Badge>}</Table.Td><Table.Td><Select size="xs" value={entry.departmentVisibility} onChange={(value) => value && updateVisibility.mutate({ id: entry.id, departmentVisibility: value })} data={[{ value: "EXACT", label: i18n.language === "en" ? "Name + exact type" : "Nome + tipo esatto" }, { value: "GENERIC", label: i18n.language === "en" ? "Name + absent" : "Nome + assente" }, { value: "HIDDEN", label: i18n.language === "en" ? "Hidden" : "Nascosto" }]} /></Table.Td></Table.Tr>)}</Table.Tbody></Table></Paper></Stack></Tabs.Panel>
      <Tabs.Panel value="balances" pt="lg"><Stack>
        <Paper className="tool-panel" withBorder p="lg"><Title order={3}>{i18n.language === "en" ? "Monthly balance file" : "File saldi mensile"}</Title><SimpleGrid cols={{ base: 1, sm: 2 }} mt="md"><FileInput label={t("chooseFile")} accept=".csv,.xlsx,.xls" value={file} onChange={setFile} leftSection={<Upload size={16} />} /><TextInput type="date" label={t("cutoff")} value={cutoff} onChange={(event) => setCutoff(event.currentTarget.value)} /></SimpleGrid><Group justify="flex-end" mt="md"><Button variant="light" disabled={!file} loading={previewFile.isPending} onClick={() => previewFile.mutate()}>{t("importPreview")}</Button></Group></Paper>
        {preview && <Paper withBorder p="md"><Group justify="space-between"><Group><Badge color="green">{preview.validCount} {i18n.language === "en" ? "valid" : "valide"}</Badge><Badge color={preview.errorCount ? "red" : "gray"}>{preview.errorCount} {i18n.language === "en" ? "errors" : "errori"}</Badge>{preview.duplicateBatchId && <Badge color="orange">{i18n.language === "en" ? "Duplicate" : "Duplicato"}</Badge>}</Group><Button disabled={preview.errorCount > 0 || Boolean(preview.duplicateBatchId)} loading={commit.isPending} onClick={() => commit.mutate()}>{i18n.language === "en" ? "Commit" : "Conferma"}</Button></Group><Table.ScrollContainer minWidth={620}><Table mt="md"><Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>{t("employee")}</Table.Th><Table.Th>Account</Table.Th><Table.Th>{t("amount")}</Table.Th><Table.Th>{i18n.language === "en" ? "Validation" : "Verifica"}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{preview.rows.slice(0, 25).map((row) => <Table.Tr key={row.rowNumber}><Table.Td>{row.rowNumber}</Table.Td><Table.Td>{row.employeeNumber}</Table.Td><Table.Td>{row.accountCode}</Table.Td><Table.Td>{row.amount}</Table.Td><Table.Td>{row.errors.join(", ") || "OK"}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper>}
        <SimpleGrid cols={{ base: 1, lg: 2 }}>
          <Paper className="tool-panel" withBorder p="lg"><Title order={3}>{i18n.language === "en" ? "Approved future absences" : "Assenze future già approvate"}</Title><FileInput mt="md" label={t("chooseFile")} accept=".csv,.xlsx,.xls" value={futureFile} onChange={setFutureFile} leftSection={<Upload size={16} />} /><Group justify="flex-end" mt="md"><Button variant="light" disabled={!futureFile} loading={importFuture.isPending} onClick={() => importFuture.mutate()}>{i18n.language === "en" ? "Import" : "Importa"}</Button></Group></Paper>
          <Paper className="tool-panel" withBorder p="lg"><Title order={3}>{i18n.language === "en" ? "Manual adjustment" : "Rettifica manuale"}</Title><Stack mt="md"><Select searchable label={t("employee")} value={adjustment.employeeId} onChange={(value) => setAdjustment({ ...adjustment, employeeId: value ?? "" })} data={data.data?.employees.map((entry) => ({ value: entry.id, label: entry.displayName })) ?? []} /><SimpleGrid cols={2}><Select label="Account" value={adjustment.accountCode} onChange={(value) => setAdjustment({ ...adjustment, accountCode: value ?? "FERIE" })} data={["FERIE", "EX_FESTIVITA", "PERMESSO"]} /><NumberInput label={t("amount")} value={adjustment.amount} onChange={(value) => setAdjustment({ ...adjustment, amount: value })} /></SimpleGrid><TextInput type="date" label={t("startDate")} value={adjustment.effectiveDate} onChange={(event) => setAdjustment({ ...adjustment, effectiveDate: event.currentTarget.value })} /><Textarea label={i18n.language === "en" ? "Reason" : "Motivo"} value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.currentTarget.value })} /><Group justify="flex-end"><Button disabled={!adjustment.employeeId || !adjustment.amount || adjustment.reason.length < 3} loading={adjust.isPending} onClick={() => adjust.mutate()}>{t("save")}</Button></Group></Stack></Paper>
        </SimpleGrid>
      </Stack></Tabs.Panel>
      <Tabs.Panel value="reconciliation" pt="lg"><Stack>{data.data?.reconciliation.length ? <Paper withBorder><Table><Table.Thead><Table.Tr><Table.Th>{t("status")}</Table.Th><Table.Th>{i18n.language === "en" ? "Reference" : "Riferimento"}</Table.Th><Table.Th>{t("actions")}</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.data.reconciliation.map((entry) => <Table.Tr key={entry.id}><Table.Td><Badge color={entry.status === "DISCREPANCY" ? "orange" : entry.status === "RESOLVED" || entry.status === "MATCHED" ? "green" : "gray"}>{entry.status}</Badge></Table.Td><Table.Td>{entry.externalReference ?? "—"}</Table.Td><Table.Td><Button size="xs" variant="subtle" disabled={entry.status === "RESOLVED"} onClick={() => setResolution({ id: entry.id, text: "" })}>{i18n.language === "en" ? "Resolve" : "Risolvi"}</Button></Table.Td></Table.Tr>)}</Table.Tbody></Table></Paper> : <Text c="dimmed">{i18n.language === "en" ? "No reconciliation cases." : "Nessun caso di riconciliazione."}</Text>}{resolution.id && <Paper withBorder p="lg" maw={680}><Textarea label={i18n.language === "en" ? "Resolution" : "Risoluzione"} value={resolution.text} onChange={(event) => setResolution({ ...resolution, text: event.currentTarget.value })} /><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setResolution({ id: "", text: "" })}>{i18n.language === "en" ? "Cancel" : "Annulla"}</Button><Button disabled={resolution.text.length < 3} loading={resolve.isPending} onClick={() => resolve.mutate()}>{t("save")}</Button></Group></Paper>}</Stack></Tabs.Panel>
      <Tabs.Panel value="holidays" pt="lg"><Stack><Paper withBorder p="lg" className="tool-panel"><Title order={3}>{i18n.language === "en" ? "Add one-off closure" : "Aggiungi chiusura una tantum"}</Title><SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mt="md"><TextInput label="Code" value={holiday.code} onChange={(event) => setHoliday({ ...holiday, code: event.currentTarget.value })} /><TextInput label="Italiano" value={holiday.labelIt} onChange={(event) => setHoliday({ ...holiday, labelIt: event.currentTarget.value })} /><TextInput label="English" value={holiday.labelEn} onChange={(event) => setHoliday({ ...holiday, labelEn: event.currentTarget.value })} /><TextInput type="date" label={t("startDate")} value={holiday.oneOffDate} onChange={(event) => setHoliday({ ...holiday, oneOffDate: event.currentTarget.value })} /></SimpleGrid><Group justify="flex-end" mt="md"><Button disabled={!holiday.code || !holiday.labelIt || !holiday.labelEn} loading={saveHoliday.isPending} onClick={() => saveHoliday.mutate()}>{t("save")}</Button></Group></Paper><Paper withBorder><Table><Table.Thead><Table.Tr><Table.Th>Code</Table.Th><Table.Th>Italiano</Table.Th><Table.Th>English</Table.Th><Table.Th>Kind</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{holidays.data?.map((entry) => <Table.Tr key={entry.id}><Table.Td>{entry.code}</Table.Td><Table.Td>{entry.labelIt}</Table.Td><Table.Td>{entry.labelEn}</Table.Td><Table.Td><Badge variant="light">{entry.kind}</Badge></Table.Td></Table.Tr>)}</Table.Tbody></Table></Paper></Stack></Tabs.Panel>
      <Tabs.Panel value="audit" pt="lg"><Paper withBorder><Table.ScrollContainer minWidth={700}><Table><Table.Thead><Table.Tr><Table.Th>When</Table.Th><Table.Th>Action</Table.Th><Table.Th>Entity</Table.Th><Table.Th>Actor</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{data.data?.audit.map((entry) => <Table.Tr key={entry.id}><Table.Td>{new Date(entry.createdAt).toLocaleString(i18n.language)}</Table.Td><Table.Td>{entry.action}</Table.Td><Table.Td>{entry.entityType}</Table.Td><Table.Td>{entry.actorSubject}</Table.Td></Table.Tr>)}</Table.Tbody></Table></Table.ScrollContainer></Paper></Tabs.Panel>
    </Tabs>
  </Stack>;
}
