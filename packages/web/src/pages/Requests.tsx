import { Button, Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, type RequestListItem } from "../api";
import { EmptyState, PageLoader, RequestRow } from "../components";

export function Requests() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("ACTIVE");
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => api<RequestListItem[]>("/requests") });
  const action = useMutation({
    mutationFn: (id: string) => api<RequestListItem>(`/requests/${id}/withdraw`, { method: "POST" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["requests"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const visible = requests.data?.filter((entry) => filter === "ALL" || ["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL", "APPROVED", "CANCELLATION_REQUESTED"].includes(entry.status)) ?? [];
  return <Stack gap="lg"><div><Text size="sm" c="dimmed">Self service</Text><Title order={1}>{t("requests")}</Title></div>
    <SegmentedControl value={filter} onChange={setFilter} data={[{ value: "ACTIVE", label: i18n.language === "en" ? "Current" : "Correnti" }, { value: "ALL", label: i18n.language === "en" ? "All" : "Tutte" }]} />
    {requests.isLoading ? <PageLoader /> : visible.length ? <Stack gap="sm">{visible.map((item) => <RequestRow key={item.id} item={item} actions={(["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL", "APPROVED"].includes(item.status)) ? <>{item.status === "APPROVED" && <Button size="xs" variant="light" onClick={() => navigate(`/new?revision=${item.id}`)}>{i18n.language === "en" ? "Change" : "Modifica"}</Button>}<Button size="xs" variant="subtle" color="red" loading={action.isPending} onClick={() => action.mutate(item.id)}>{item.status === "APPROVED" ? t("cancelRequest") : t("withdraw")}</Button></> : null} />)}</Stack> : <EmptyState>{i18n.language === "en" ? "No requests in this view." : "Nessuna richiesta in questa vista."}</EmptyState>}
  </Stack>;
}
