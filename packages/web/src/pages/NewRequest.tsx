import { Alert, Button, Divider, Group, Loader, NumberInput, Paper, SegmentedControl, Select, SimpleGrid, Stack, Stepper, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, type BalanceSummary, type MeResponse, type PreviewResponse, type RequestListItem } from "../api";
import { Quantity } from "../components";
import { RequestDatePicker } from "../components/RequestDatePicker";
import { formatPortalDate, formatPortalDateWithWeekday, formatPortalList, permissionEndSlots, permissionStartSlots } from "../request-calendar";

type Kind = "FERIE" | "PERMESSO";

interface AllocationFieldProps {
  balance?: BalanceSummary;
  fallbackLabel: string;
  value: number | string;
  onChange: (value: number | string) => void;
}

function AllocationField({ balance, fallbackLabel, value, onChange }: AllocationFieldProps) {
  const { t, i18n } = useTranslation();
  const allocation = typeof value === "number" ? value : Number(value) || 0;
  const remaining = balance?.available === null || balance?.available === undefined
    ? null
    : balance.available - allocation;
  const label = balance ? (i18n.language === "en" ? balance.labelEn : balance.labelIt) : fallbackLabel;

  return <div className="allocation-field">
    <Group justify="space-between" align="baseline" gap="xs" wrap="wrap">
      <Text fw={700}>{label}</Text>
      {balance?.available === null || balance?.available === undefined
        ? <Text size="sm" c="orange" fw={600}>{t("noBalance")}</Text>
        : <Text size="sm" c={balance.stale ? "orange" : "green.8"} fw={700}>{t("available")}: <Quantity amount={balance.available} unit={balance.unit} /></Text>}
    </Group>
    <NumberInput
      mt="sm"
      min={0}
      decimalScale={2}
      label={t("daysToUse")}
      value={value}
      onChange={onChange}
      suffix={i18n.language === "en" ? " d" : " gg"}
    />
    <Group justify="space-between" gap="xs" mt={8} wrap="wrap">
      {balance && <Text size="xs" c="dimmed">{t("pending")}: <strong><Quantity amount={balance.pending} unit={balance.unit} /></strong></Text>}
      {remaining !== null && <Text size="xs" c={remaining < 0 ? "red" : "dimmed"}>{t("afterRequest")}: <strong><Quantity amount={remaining} unit={balance?.unit ?? "DAYS"} /></strong></Text>}
    </Group>
    {balance && <Text size="xs" c={balance.stale ? "orange" : "dimmed"} mt={6}>
      {balance.asOf
        ? `${balance.stale ? `${t("stale")} · ` : ""}${t("asOf")} ${formatPortalDate(balance.asOf, i18n.language)}`
        : balance.stale ? t("stale") : t("noBalance")}
    </Text>}
  </div>;
}

export function NewRequest({ me }: { me: MeResponse }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const revisionOfId = searchParams.get("revision") ?? undefined;
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<Kind>("FERIE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ferie, setFerie] = useState<number | string>(0);
  const [exFestivita, setExFestivita] = useState<number | string>(0);
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => api<RequestListItem[]>("/requests"), enabled: Boolean(revisionOfId) });
  useEffect(() => {
    const source = requests.data?.find((entry) => entry.id === revisionOfId);
    if (!source) return;
    setKind(source.absenceTypeCode === "PERMESSO" ? "PERMESSO" : "FERIE");
    setStartDate(source.startDate);
    setEndDate(source.endDate);
    setStartTime(source.startTime ?? "");
    setEndTime(source.endTime ?? "");
    setFerie(source.allocations?.find((entry) => entry.accountCode === "FERIE")?.amount ?? 0);
    setExFestivita(source.allocations?.find((entry) => entry.accountCode === "EX_FESTIVITA")?.amount ?? 0);
  }, [requests.data, revisionOfId]);

  const payload = (includeAllocations: boolean) => kind === "PERMESSO"
    ? { absenceTypeCode: kind, startDate, endDate: startDate, startTime, endTime, revisionOfId }
    : { absenceTypeCode: kind, startDate, endDate, revisionOfId, allocations: includeAllocations ? [{ accountCode: "FERIE", amount: Number(ferie) }, { accountCode: "EX_FESTIVITA", amount: Number(exFestivita) }].filter((entry) => entry.amount > 0) : [] };
  const previewInput = payload(false);
  const previewReady = Boolean(startDate && endDate && (kind === "FERIE" || (startTime && endTime)));
  const previewQuery = useQuery({
    queryKey: ["request-preview", previewInput],
    queryFn: () => api<PreviewResponse>("/requests/preview", { method: "POST", body: JSON.stringify(previewInput) }),
    enabled: previewReady,
    retry: false,
  });
  const preview = previewQuery.data ?? null;
  useEffect(() => {
    if (!preview || kind !== "FERIE") return;
    if (Math.abs(Number(ferie) + Number(exFestivita) - preview.quantity) < 0.001) return;
    setFerie(preview.quantity);
    setExFestivita(0);
  }, [preview]);
  const submit = useMutation({
    mutationFn: () => api<RequestListItem>("/requests", { method: "POST", body: JSON.stringify(payload(true)) }),
    onSuccess: async () => { toast.success(t("requestCreated")); await queryClient.invalidateQueries(); navigate("/requests"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const allocationValid = kind === "PERMESSO" || (preview && Math.abs(Number(ferie) + Number(exFestivita) - preview.quantity) < 0.001);
  const ferieBalance = preview?.balances.find((entry) => entry.code === "FERIE");
  const exFestivitaBalance = preview?.balances.find((entry) => entry.code === "EX_FESTIVITA");
  const excludedDates = preview?.segments.filter((entry) => entry.exclusionReason).map((entry) => {
    const holidayNames = [...new Set((entry.holidays ?? []).map((holiday) => i18n.language === "en" ? holiday.labelEn : holiday.labelIt))];
    const date = formatPortalDateWithWeekday(entry.date, i18n.language);
    return holidayNames.length > 0 ? `${date} (${formatPortalList(holidayNames, i18n.language)})` : date;
  }) ?? [];
  const changeKind = (nextKind: Kind) => {
    if (nextKind === kind) return;
    setKind(nextKind);
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setFerie(0);
    setExFestivita(0);
  };

  const setRequestDates = (nextStart: string, nextEnd: string) => {
    const dateChanged = nextStart !== startDate;
    setStartDate(nextStart);
    setEndDate(nextEnd);
    if (!nextStart || (kind === "PERMESSO" && dateChanged)) {
      setStartTime("");
      setEndTime("");
    }
  };

  const startTimeOptions = useMemo(
    () => (kind === "PERMESSO" && startDate ? permissionStartSlots(startDate, me.employee.schedule) : []),
    [kind, startDate, me.employee.schedule],
  );
  const endTimeOptions = useMemo(
    () => (kind === "PERMESSO" && startDate && startTime ? permissionEndSlots(startDate, me.employee.schedule, startTime) : []),
    [kind, startDate, startTime, me.employee.schedule],
  );
  useEffect(() => {
    if (kind !== "PERMESSO") return;
    if (startTime && !startTimeOptions.includes(startTime)) {
      setStartTime("");
      setEndTime("");
      return;
    }
    if (endTime && !endTimeOptions.includes(endTime)) setEndTime("");
  }, [kind, startTime, endTime, startTimeOptions, endTimeOptions]);

  return <Stack gap="xl" maw={840} className="request-form">
    <Title order={1} className="request-page-heading">{t("newRequest")}</Title>
    <Stepper active={preview ? 1 : 0} size="sm" className="request-stepper"><Stepper.Step label={i18n.language === "en" ? "Dates" : "Date"} /><Stepper.Step label={t("allocation")} /><Stepper.Step label={i18n.language === "en" ? "Confirmation" : "Conferma"} /></Stepper>
    <Paper withBorder p={{ base: "md", sm: "xl" }} className="tool-panel request-form-panel">
      <Stack gap="xl" className="request-form-fields">
        <SegmentedControl fullWidth value={kind} onChange={(value) => changeKind(value as Kind)} data={[{ value: "FERIE", label: t("annualLeave") }, { value: "PERMESSO", label: t("hourlyLeave") }]} />
        <RequestDatePicker key={kind} kind={kind} startDate={startDate} endDate={endDate} schedule={me.employee.schedule} revisionOfId={revisionOfId} onChange={setRequestDates} />
        {kind === "PERMESSO" && startDate && <Stack gap="md">
          <Select
            label={t("startTime")}
            placeholder={t("chooseTime")}
            data={startTimeOptions}
            value={startTime || null}
            onChange={(value) => {
              setStartTime(value ?? "");
              setEndTime("");
            }}
            allowDeselect={false}
            searchable={false}
          />
          {startTime && <Select
            label={t("endTime")}
            placeholder={t("chooseTime")}
            data={endTimeOptions}
            value={endTime || null}
            onChange={(value) => setEndTime(value ?? "")}
            allowDeselect={false}
            searchable={false}
          />}
        </Stack>}
        {previewQuery.isFetching && <Group gap="xs" c="dimmed"><Loader size="sm" /><Text size="sm">{t("calculatingRequest")}</Text></Group>}
        {previewQuery.isError && <Alert color="red" icon={<AlertTriangle size={17} />}>{previewQuery.error.message}</Alert>}
      </Stack>
    </Paper>
    {preview && <Paper withBorder p={{ base: "md", sm: "xl" }} className="tool-panel request-preview-panel"><Stack gap="md">
      <Group justify="space-between"><Text fw={700}>{t("deductible")}</Text><Text size="xl" fw={800}><Quantity amount={preview.quantity} unit={preview.unit} /></Text></Group>
      {excludedDates.length > 0 && <Text size="sm" c="dimmed">{t("excluded")}: {formatPortalList(excludedDates, i18n.language)}</Text>}
      {kind === "FERIE" && <>
        <Divider />
        <Group justify="space-between" align="baseline" gap="xs" wrap="wrap">
          <Text fw={700}>{t("allocation")}</Text>
          <Text size="sm" c="dimmed">{t("toAllocate")}: <strong><Quantity amount={preview.quantity} unit={preview.unit} /></strong></Text>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} className="allocation-grid">
          <AllocationField balance={ferieBalance} fallbackLabel={t("annualLeave")} value={ferie} onChange={setFerie} />
          <AllocationField balance={exFestivitaBalance} fallbackLabel={i18n.language === "en" ? "Former public holidays" : "Ex festività"} value={exFestivita} onChange={setExFestivita} />
        </SimpleGrid>
        {!allocationValid && <Text size="sm" c="red">{i18n.language === "en" ? "The allocation must equal the deductible days." : "La ripartizione deve corrispondere ai giorni da scalare."}</Text>}
      </>}
      {preview.overBalance && <Alert color="orange" icon={<AlertTriangle size={18} />}>{t("warningOver")}</Alert>}
      <Divider /><Group justify="space-between"><Group gap="xs"><Check size={18} color="var(--mantine-color-green-7)" /><Text size="sm">{i18n.language === "en" ? "Dates and schedule validated" : "Date e orario verificati"}</Text></Group><Button leftSection={<Send size={17} />} disabled={!allocationValid} loading={submit.isPending} onClick={() => submit.mutate()}>{t("submit")}</Button></Group>
    </Stack></Paper>}
  </Stack>;
}
