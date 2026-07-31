import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { api, type RequestListItem } from "../api";
import { EmptyState, PageHeading, PageLoader, RequestRow } from "../components";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";

const ACTIVE_STATUSES = ["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL", "APPROVED", "CANCELLATION_REQUESTED"];

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
  const visible = requests.data?.filter((entry) => filter === "ALL" || ACTIVE_STATUSES.includes(entry.status)) ?? [];

  return <div className="flex flex-col gap-5">
    <PageHeading eyebrow="Self service" title={t("requests")} />
    <SegmentedControl
      value={filter}
      onChange={setFilter}
      aria-label={t("status")}
      data={[
        { value: "ACTIVE", label: i18n.language === "en" ? "Current" : "Correnti" },
        { value: "ALL", label: i18n.language === "en" ? "All" : "Tutte" },
      ]}
    />
    {requests.isLoading ? <PageLoader /> : visible.length ? (
      <div className="flex flex-col gap-3">
        {visible.map((item) => (
          <RequestRow
            key={item.id}
            item={item}
            actions={["PENDING_APPROVAL", "PENDING_FINAL_APPROVAL", "APPROVED"].includes(item.status) ? <>
              {item.status === "APPROVED" && <Button size="sm" variant="secondary" onClick={() => navigate(`/new?revision=${item.id}`)}>{i18n.language === "en" ? "Change" : "Modifica"}</Button>}
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" loading={action.isPending} onClick={() => action.mutate(item.id)}>
                {item.status === "APPROVED" ? t("cancelRequest") : t("withdraw")}
              </Button>
            </> : null}
          />
        ))}
      </div>
    ) : <EmptyState>{i18n.language === "en" ? "No requests in this view." : "Nessuna richiesta in questa vista."}</EmptyState>}
  </div>;
}
