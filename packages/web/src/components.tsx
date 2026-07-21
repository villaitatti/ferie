import { Badge, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon } from "@mantine/core";
import { AlertCircle, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BalanceSummary, RequestListItem } from "./api";
import { formatPortalDate } from "./request-calendar";

const statusColors: Record<string, string> = {
  APPROVED: "green",
  DECLINED: "red",
  PENDING_APPROVAL: "yellow",
  PENDING_FINAL_APPROVAL: "orange",
  WITHDRAWN: "gray",
  CANCELLATION_REQUESTED: "grape",
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
  return <Badge color={statusColors[status] ?? "gray"} variant="light">{label}</Badge>;
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
    <Paper className="balance-tile" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Text size="sm" c="dimmed" fw={600}>{i18n.language === "en" ? balance.labelEn : balance.labelIt}</Text>
          <Text className="balance-value" component="div"><Quantity amount={balance.projected ?? 0} unit={balance.unit} /></Text>
        </div>
        <ThemeIcon variant="light" color={balance.stale ? "orange" : "forest"} size="lg"><CalendarDays size={19} /></ThemeIcon>
      </Group>
      {balance.projected === null ? <Text size="xs" c="orange">{t("noBalance")}</Text> : (
        <Group gap="md" mt="sm">
          <Text size="xs" c="dimmed">{t("imported")}: <strong><Quantity amount={balance.imported ?? 0} unit={balance.unit} /></strong></Text>
          <Text size="xs" c="dimmed">{t("pending")}: <strong><Quantity amount={balance.pending} unit={balance.unit} /></strong></Text>
        </Group>
      )}
      <Text size="xs" c={balance.stale ? "orange" : "dimmed"} mt={6}>{balance.asOf ? `${t("asOf")} ${formatPortalDate(balance.asOf, i18n.language)}` : t("stale")}</Text>
    </Paper>
  );
}

export function RequestRow({ item, actions }: { item: RequestListItem; actions?: React.ReactNode }) {
  const { i18n } = useTranslation();
  return (
    <Paper className="request-row" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div className="request-main">
          <Group gap="xs"><Text fw={700}>{i18n.language === "en" ? item.absenceTypeLabelEn : item.absenceTypeLabelIt}</Text><StatusBadge status={item.status} /></Group>
          <Text size="sm" c="dimmed">{item.employeeName} · {item.departmentName}</Text>
          <Text size="sm" mt={6}>{formatPortalDate(item.startDate, i18n.language)}{item.endDate !== item.startDate ? ` – ${formatPortalDate(item.endDate, i18n.language)}` : ""}{item.startTime ? ` · ${item.startTime}–${item.endTime}` : ""}</Text>
        </div>
        <Stack gap={6} align="flex-end">
          <Text fw={700}><Quantity amount={item.quantity} unit={item.unit} /></Text>
          {item.overBalance && <Badge color="orange" leftSection={<AlertCircle size={12} />}>{i18n.language === "en" ? "Over balance" : "Saldo superato"}</Badge>}
        </Stack>
      </Group>
      {actions && <Group mt="md" justify="flex-end">{actions}</Group>}
    </Paper>
  );
}

export function PageLoader() {
  return <Stack gap="md"><Skeleton height={70} /><Skeleton height={130} /><Skeleton height={130} /></Stack>;
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return <div className="empty-state"><CalendarDays size={34} strokeWidth={1.5} /><Text c="dimmed">{children}</Text>{action && <Button variant="light" onClick={action.onClick}>{action.label}</Button>}</div>;
}
