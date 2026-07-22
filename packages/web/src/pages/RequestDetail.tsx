import { Alert, Button, Divider, Group, Modal, SimpleGrid, Stack, Text, Textarea, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, Pencil, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../api";
import { EmptyState, PageLoader, Quantity, RequestRow, StatusBadge } from "../components";
import { formatPortalDateTime } from "../request-calendar";
import type { RequestDetail as RequestDetailResponse } from "@ferie/shared";

type Decision = "APPROVE" | "DECLINE" | "ESCALATE";

function decisionLabel(action: string, language: string) {
  const labels: Record<string, { it: string; en: string }> = {
    SUBMIT: { it: "Richiesta inviata", en: "Request submitted" },
    APPROVE: { it: "Approvata", en: "Approved" },
    DECLINE: { it: "Rifiutata", en: "Declined" },
    ESCALATE: { it: "Inviata all'approvazione finale", en: "Sent for final approval" },
    WITHDRAW: { it: "Ritirata", en: "Withdrawn" },
    REQUEST_CANCELLATION: { it: "Annullamento richiesto", en: "Cancellation requested" },
  };
  return labels[action]?.[language === "en" ? "en" : "it"] ?? action;
}

export function RequestDetail() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const detail = useQuery({ queryKey: ["request", id], queryFn: () => api<RequestDetailResponse>(`/requests/${id}`), enabled: Boolean(id) });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["request", id] }),
      queryClient.invalidateQueries({ queryKey: ["requests"] }),
      queryClient.invalidateQueries({ queryKey: ["approvals"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
  };
  const decide = useMutation({
    mutationFn: (action: Decision) => api(`/requests/${id}/decision`, { method: "POST", body: JSON.stringify({ action, comment: comment || undefined, expectedStatus: detail.data?.status }) }),
    onSuccess: async () => { toast.success(t("decisionSaved")); close(); setComment(""); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const withdraw = useMutation({
    mutationFn: () => api(`/requests/${id}/withdraw`, { method: "POST" }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const choose = (action: Decision) => { setDecision(action); open(); };

  if (detail.isLoading) return <PageLoader />;
  if (detail.isError || !detail.data) return <EmptyState>{i18n.language === "en" ? "This request is unavailable or you no longer have access." : "Questa richiesta non è disponibile o non hai più accesso."}</EmptyState>;
  const item = detail.data;
  const backPath = item.permissions.approvalContext ? "/approvals" : "/requests";

  return <Stack gap="xl">
    <div>
      <Button variant="subtle" color="gray" px={0} leftSection={<ArrowLeft size={17} />} onClick={() => navigate(backPath)}>{i18n.language === "en" ? "Back" : "Indietro"}</Button>
      <Text size="sm" c="dimmed" mt="sm">{i18n.language === "en" ? "Request details" : "Dettaglio della richiesta"}</Text>
      <Title order={1}>{i18n.language === "en" ? item.absenceTypeLabelEn : item.absenceTypeLabelIt}</Title>
    </div>
    <RequestRow item={item} />
    <Group justify="flex-end">
      {item.permissions.canModify && <Button variant="light" leftSection={<Pencil size={16} />} onClick={() => navigate(`/new?revision=${item.id}`)}>{i18n.language === "en" ? "Change" : "Modifica"}</Button>}
      {(item.permissions.canWithdraw || item.permissions.canRequestCancellation) && <Button variant="subtle" color="red" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>{item.permissions.canRequestCancellation ? t("cancelRequest") : t("withdraw")}</Button>}
      {item.permissions.canDecide && <>
        <Button variant="light" color="red" leftSection={<X size={15} />} onClick={() => choose("DECLINE")}>{t("decline")}</Button>
        {item.overBalance && item.status === "PENDING_APPROVAL"
          ? <Button color="orange" leftSection={<ShieldCheck size={15} />} onClick={() => choose("ESCALATE")}>{t("escalate")}</Button>
          : <Button color="green" leftSection={<Check size={15} />} onClick={() => choose("APPROVE")}>{t("approve")}</Button>}
      </>}
    </Group>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" className="request-detail-grid">
      <section>
        <Title order={2}>{i18n.language === "en" ? "Balance allocation" : "Ripartizione del saldo"}</Title>
        <Divider my="sm" />
        {item.allocations.length ? <Stack gap="xs">{item.allocations.map((allocation) => <Group key={allocation.accountCode} justify="space-between"><Text>{allocation.accountCode.replace("_", " ")}</Text><Text fw={700}><Quantity amount={allocation.amount} unit={item.unit} /></Text></Group>)}</Stack> : <Text c="dimmed">{i18n.language === "en" ? "No balance allocation." : "Nessuna ripartizione del saldo."}</Text>}
      </section>
      <section>
        <Title order={2}>{i18n.language === "en" ? "Approval history" : "Cronologia dell'approvazione"}</Title>
        <Divider my="sm" />
        <Stack gap="md">{item.decisions.map((entry) => <div key={entry.id} className="request-history-entry">
          <Group justify="space-between" align="flex-start"><div><Text fw={700}>{decisionLabel(entry.action, i18n.language)}</Text><Text size="sm" c="dimmed">{entry.actorName} · {formatPortalDateTime(entry.createdAt, i18n.language)}</Text></div><StatusBadge status={entry.toStatus} /></Group>
          {entry.comment && <Text size="sm" mt={6}>{entry.comment}</Text>}
        </div>)}</Stack>
      </section>
    </SimpleGrid>
    <Modal opened={opened} onClose={close} title={decision ? t(decision === "APPROVE" ? "approve" : decision === "DECLINE" ? "decline" : "escalate") : ""} centered>
      <Stack>{item.overBalance && <Alert color="orange" icon={<AlertCircle size={18} />}>{t("warningOver")}</Alert>}<Textarea label={i18n.language === "en" ? "Comment (optional)" : "Commento (facoltativo)"} maxLength={500} value={comment} onChange={(event) => setComment(event.currentTarget.value)} /><Group justify="flex-end"><Button variant="default" onClick={close}>{i18n.language === "en" ? "Cancel" : "Annulla"}</Button><Button color={decision === "DECLINE" ? "red" : decision === "ESCALATE" ? "orange" : "green"} loading={decide.isPending} onClick={() => decision && decide.mutate(decision)}>{decision ? t(decision === "APPROVE" ? "approve" : decision === "DECLINE" ? "decline" : "escalate") : ""}</Button></Group></Stack>
    </Modal>
  </Stack>;
}
