import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, Check, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api, type BalanceSummary, type MeResponse, type PreviewResponse, type RequestListItem } from "../api";
import { Quantity } from "../components";
import { RequestDatePicker } from "../components/RequestDatePicker";
import { formatPortalDate, formatPortalDateWithWeekday, formatPortalList, permissionEndSlots, permissionStartSlots } from "../request-calendar";
import { cn } from "@/lib/utils";
import { toneBorder, toneSoft, toneText } from "@/lib/tone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Stepper } from "@/components/ui/stepper";

type Kind = "FERIE" | "PERMESSO";

interface AllocationFieldProps {
  balance?: BalanceSummary;
  fallbackLabel: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

function AllocationField({ balance, fallbackLabel, value, onChange }: AllocationFieldProps) {
  const { t, i18n } = useTranslation();
  const allocation = value ?? 0;
  const remaining = balance?.available === null || balance?.available === undefined
    ? null
    : balance.available - allocation;
  const label = balance ? (i18n.language === "en" ? balance.labelEn : balance.labelIt) : fallbackLabel;

  return <div className="allocation-field">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="font-bold">{label}</p>
      {balance?.available === null || balance?.available === undefined
        ? <p className={cn("text-sm font-semibold", toneText.orange)}>{t("noBalance")}</p>
        : <p className={cn("text-sm font-bold", balance.stale ? toneText.orange : toneText.green)}>{t("available")}: <Quantity amount={balance.available} unit={balance.unit} /></p>}
    </div>
    <NumberField
      className="mt-3"
      min={0}
      decimalScale={2}
      label={t("daysToUse")}
      value={value}
      onChange={onChange}
      suffix={i18n.language === "en" ? "d" : "gg"}
    />
    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
      {balance && <span className="text-muted-foreground">{t("pending")}: <strong className="font-semibold"><Quantity amount={balance.pending} unit={balance.unit} /></strong></span>}
      {remaining !== null && <span className={remaining < 0 ? toneText.red : "text-muted-foreground"}>{t("afterRequest")}: <strong className="font-semibold"><Quantity amount={remaining} unit={balance?.unit ?? "DAYS"} /></strong></span>}
    </div>
    {balance && <p className={cn("mt-1.5 text-xs", balance.stale ? toneText.orange : "text-muted-foreground")}>
      {balance.asOf
        ? `${balance.stale ? `${t("stale")} · ` : ""}${t("asOf")} ${formatPortalDate(balance.asOf, i18n.language)}`
        : balance.stale ? t("stale") : t("noBalance")}
    </p>}
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
  const [ferie, setFerie] = useState<number | null>(0);
  const [exFestivita, setExFestivita] = useState<number | null>(0);
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

  return <div className="flex max-w-[840px] flex-col gap-8">
    <h1 className="request-page-heading text-[clamp(1.65rem,2.5vw,2.15rem)] font-bold">{t("newRequest")}</h1>
    <Stepper
      active={preview ? 1 : 0}
      steps={[
        i18n.language === "en" ? "Dates" : "Date",
        t("allocation"),
        i18n.language === "en" ? "Confirmation" : "Conferma",
      ]}
    />

    <Card className="request-form-panel gap-8 p-4 sm:p-8">
      <SegmentedControl
        fullWidth
        value={kind}
        onChange={(value) => changeKind(value as Kind)}
        aria-label={t("type")}
        data={[{ value: "FERIE", label: t("annualLeave") }, { value: "PERMESSO", label: t("hourlyLeave") }]}
      />
      <RequestDatePicker key={kind} kind={kind} startDate={startDate} endDate={endDate} schedule={me.employee.schedule} revisionOfId={revisionOfId} onChange={setRequestDates} />
      {kind === "PERMESSO" && startDate && <div className="flex flex-col gap-4 sm:max-w-sm">
        <SelectField
          label={t("startTime")}
          placeholder={t("chooseTime")}
          data={startTimeOptions}
          value={startTime || null}
          onChange={(value) => { setStartTime(value); setEndTime(""); }}
        />
        {startTime && <SelectField
          label={t("endTime")}
          placeholder={t("chooseTime")}
          data={endTimeOptions}
          value={endTime || null}
          onChange={setEndTime}
        />}
      </div>}
      {previewQuery.isFetching && <div className="flex items-center gap-2 text-muted-foreground"><Spinner />{t("calculatingRequest")}</div>}
      {previewQuery.isError && (
        <Alert className={cn(toneSoft.red, toneBorder.red)}>
          <AlertTriangleIcon />
          <AlertDescription className="text-current">{previewQuery.error.message}</AlertDescription>
        </Alert>
      )}
    </Card>

    {preview && <Card className="request-preview-panel gap-4 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{t("deductible")}</p>
        <p className="text-xl font-extrabold"><Quantity amount={preview.quantity} unit={preview.unit} /></p>
      </div>
      {excludedDates.length > 0 && <p className="text-sm text-muted-foreground">{t("excluded")}: {formatPortalList(excludedDates, i18n.language)}</p>}
      {kind === "FERIE" && <>
        <Separator />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bold">{t("allocation")}</p>
          <p className="text-sm text-muted-foreground">{t("toAllocate")}: <strong className="font-semibold"><Quantity amount={preview.quantity} unit={preview.unit} /></strong></p>
        </div>
        <div className="allocation-grid grid sm:grid-cols-2">
          <AllocationField balance={ferieBalance} fallbackLabel={t("annualLeave")} value={ferie} onChange={setFerie} />
          <AllocationField balance={exFestivitaBalance} fallbackLabel={i18n.language === "en" ? "Former public holidays" : "Ex festività"} value={exFestivita} onChange={setExFestivita} />
        </div>
        {!allocationValid && <p className={cn("text-sm", toneText.red)}>{i18n.language === "en" ? "The allocation must equal the deductible days." : "La ripartizione deve corrispondere ai giorni da scalare."}</p>}
      </>}
      {preview.overBalance && (
        <Alert className={cn(toneSoft.orange, toneBorder.orange)}>
          <AlertTriangleIcon />
          <AlertDescription className="text-current">{t("warningOver")}</AlertDescription>
        </Alert>
      )}
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm">
          <Check className={cn("size-[18px]", toneText.green)} />
          {i18n.language === "en" ? "Dates and schedule validated" : "Date e orario verificati"}
        </span>
        <Button disabled={!allocationValid || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? <Spinner /> : <Send className="size-[17px]" />}{t("submit")}
        </Button>
      </div>
    </Card>}
  </div>;
}
