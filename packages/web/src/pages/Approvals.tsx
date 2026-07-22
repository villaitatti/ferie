import { Alert, Button, Group, Modal, Stack, Text, Textarea, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, MessageSquare, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, type RequestListItem } from "../api";
import { EmptyState, PageLoader, RequestRow } from "../components";

export function Approvals() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => api<RequestListItem[]>("/approvals") });
  const [opened, { open, close }] = useDisclosure(false);
  const [selection, setSelection] = useState<{ item: RequestListItem; action: "APPROVE" | "DECLINE" | "ESCALATE" } | null>(null);
  const [comment, setComment] = useState("");
  const decide = useMutation({
    mutationFn: ({ item, action }: NonNullable<typeof selection>) => api(`/requests/${item.id}/decision`, { method: "POST", body: JSON.stringify({ action, comment: comment || undefined, expectedStatus: item.status }) }),
    onSuccess: async () => { toast.success(t("decisionSaved")); close(); setComment(""); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const choose = (item: RequestListItem, action: "APPROVE" | "DECLINE" | "ESCALATE") => { setSelection({ item, action }); open(); };
  return <Stack gap="lg"><div><Text size="sm" c="dimmed">Workflow</Text><Title order={1}>{t("approvals")}</Title></div><Alert variant="light" color="blue" icon={<MessageSquare size={18} />}>{t("staffing")}</Alert>
    {approvals.isLoading ? <PageLoader /> : approvals.data?.length ? <Stack gap="sm">{approvals.data.map((item) => <RequestRow key={item.id} item={item} actions={<>
      <Button size="xs" variant="light" color="red" leftSection={<X size={15} />} onClick={() => choose(item, "DECLINE")}>{t("decline")}</Button>
      {item.overBalance && item.status === "PENDING_APPROVAL" ? <Button size="xs" color="orange" leftSection={<ShieldCheck size={15} />} onClick={() => choose(item, "ESCALATE")}>{t("escalate")}</Button> : <Button size="xs" color="green" leftSection={<Check size={15} />} onClick={() => choose(item, "APPROVE")}>{t("approve")}</Button>}
    </>} />)}</Stack> : <EmptyState>{i18n.language === "en" ? "No requests require your decision." : "Nessuna richiesta richiede una decisione."}</EmptyState>}
    <Modal opened={opened} onClose={close} title={selection ? t(selection.action === "APPROVE" ? "approve" : selection.action === "DECLINE" ? "decline" : "escalate") : ""} centered>
      <Stack>{selection?.item.overBalance && <Alert color="orange" icon={<AlertCircle size={18} />}>{t("warningOver")}</Alert>}<Textarea label={i18n.language === "en" ? "Comment (optional)" : "Commento (facoltativo)"} maxLength={500} value={comment} onChange={(event) => setComment(event.currentTarget.value)} /><Group justify="flex-end"><Button variant="default" onClick={close}>{i18n.language === "en" ? "Cancel" : "Annulla"}</Button><Button color={selection?.action === "DECLINE" ? "red" : selection?.action === "ESCALATE" ? "orange" : "green"} loading={decide.isPending} onClick={() => selection && decide.mutate(selection)}>{selection ? t(selection.action === "APPROVE" ? "approve" : selection.action === "DECLINE" ? "decline" : "escalate") : ""}</Button></Group></Stack>
    </Modal>
  </Stack>;
}
