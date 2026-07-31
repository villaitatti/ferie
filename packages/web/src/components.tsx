import { AlertCircleIcon, CalendarDaysIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { BalanceSummary, RequestListItem } from "./api";
import { formatPortalDate } from "./request-calendar";
import { cn } from "@/lib/utils";
import { toneSoft, toneText, type Tone } from "@/lib/tone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

const statusTones: Record<string, Tone> = {
  APPROVED: "green",
  DECLINED: "red",
  PENDING_APPROVAL: "yellow",
  PENDING_FINAL_APPROVAL: "orange",
  WITHDRAWN: "gray",
  CANCELLATION_REQUESTED: "violet",
  CANCELLED: "gray",
};

const statusLabels: Record<string, { it: string; en: string }> = {
  DRAFT: { it: "Bozza", en: "Draft" },
  PENDING_APPROVAL: { it: "In approvazione", en: "Pending approval" },
  PENDING_FINAL_APPROVAL: { it: "Approvazione finale", en: "Final approval" },
  APPROVED: { it: "Approvata", en: "Approved" },
  DECLINED: { it: "Rifiutata", en: "Declined" },
  WITHDRAWN: { it: "Ritirata", en: "Withdrawn" },
  CHANGE_REQUESTED: { it: "Modifica richiesta", en: "Change requested" },
  CANCELLATION_REQUESTED: { it: "Annullamento richiesto", en: "Cancellation requested" },
  CANCELLED: { it: "Annullata", en: "Cancelled" },
};

export function StatusBadge({ status }: { status: string }) {
  const { i18n } = useTranslation();
  const label = statusLabels[status]?.[i18n.language === "en" ? "en" : "it"] ?? status;
  return <Badge variant="ghost" className={cn("border-transparent", toneSoft[statusTones[status] ?? "gray"])}>{label}</Badge>;
}

export function Quantity({ amount, unit }: { amount: number; unit: string }) {
  const { i18n } = useTranslation();
  const hours = Math.floor(amount / 60);
  const minutes = amount % 60;
  return <>{unit === "MINUTES" ? `${hours}h ${minutes ? `${minutes}m` : ""}` : `${amount} ${i18n.language === "en" ? "d" : "gg"}`}</>;
}

export function BalanceTile({ balance }: { balance: BalanceSummary }) {
  const { t, i18n } = useTranslation();
  return (
    <Card className="balance-tile gap-0 p-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{i18n.language === "en" ? balance.labelEn : balance.labelIt}</p>
          <p className="mt-1 text-[1.75rem] leading-tight font-extrabold">
            {balance.projected === null ? "—" : <Quantity amount={balance.projected} unit={balance.unit} />}
          </p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", toneSoft[balance.stale ? "orange" : "primary"])}>
          <CalendarDaysIcon className="size-[19px]" />
        </span>
      </div>
      {balance.projected === null ? (
        <p className={cn("mt-3 text-xs", toneText.orange)}>{t("noBalance")}</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{t("imported")}: <strong className="font-semibold"><Quantity amount={balance.imported ?? 0} unit={balance.unit} /></strong></span>
          <span>{t("pending")}: <strong className="font-semibold"><Quantity amount={balance.pending} unit={balance.unit} /></strong></span>
        </div>
      )}
      {balance.projected !== null && (
        <p className={cn("mt-1.5 text-xs", balance.stale ? toneText.orange : "text-muted-foreground")}>
          {balance.asOf ? `${t("asOf")} ${formatPortalDate(balance.asOf, i18n.language)}` : t("stale")}
        </p>
      )}
    </Card>
  );
}

export function RequestRow({ item, actions }: { item: RequestListItem; actions?: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <Card className="gap-0 px-[18px] py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{i18n.language === "en" ? item.absenceTypeLabelEn : item.absenceTypeLabelIt}</p>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">{item.employeeName} · {item.departmentName}</p>
          <p className="mt-1.5 text-sm">
            {formatPortalDate(item.startDate, i18n.language)}
            {item.endDate !== item.startDate ? ` – ${formatPortalDate(item.endDate, i18n.language)}` : ""}
            {item.startTime ? ` · ${item.startTime}–${item.endTime}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <p className="font-bold whitespace-nowrap"><Quantity amount={item.quantity} unit={item.unit} /></p>
          {item.overBalance && (
            <Badge variant="ghost" className={cn("gap-1", toneSoft.orange)}>
              <AlertCircleIcon className="size-3" />
              {i18n.language === "en" ? "Over balance" : "Saldo superato"}
            </Badge>
          )}
        </div>
      </div>
      {actions && <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div>}
    </Card>
  );
}

/** Every page opens the same way: a quiet context line, the title, and optionally one page action. */
export function PageHeading({ eyebrow, title, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-sm text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="text-[clamp(1.65rem,2.5vw,2.15rem)] leading-tight font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-[1.12rem] font-semibold", className)} {...props} />;
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold", className)} {...props} />;
}

export function PageLoader() {
  return <div className="flex flex-col gap-4"><Skeleton className="h-[70px] w-full" /><Skeleton className="h-[130px] w-full" /><Skeleton className="h-[130px] w-full" /></div>;
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <Empty className="min-h-[180px] rounded-md border bg-card/60">
      <EmptyHeader>
        <EmptyMedia>
          <CalendarDaysIcon className="size-[34px] text-muted-foreground" strokeWidth={1.5} />
        </EmptyMedia>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent><Button variant="secondary" onClick={action.onClick}>{action.label}</Button></EmptyContent>}
    </Empty>
  );
}
