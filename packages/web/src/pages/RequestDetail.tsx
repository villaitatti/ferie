import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, ArrowLeft, Check, Pencil, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { RequestDetail as RequestDetailResponse } from "@ferie/shared";

import { api } from "../api";
import { EmptyState, PageLoader, Quantity, RequestRow, SectionTitle, StatusBadge } from "../components";
import { formatPortalDateTime } from "../request-calendar";
import { cn } from "@/lib/utils";
import { type Decision, decisionKey, decisionTone } from "@/lib/decisions";
import { toneBorder, toneSoft, toneSoftButton, toneSolid } from "@/lib/tone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { TextareaField } from "@/components/ui/text-field";

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
    onSuccess: async () => { toast.success(t("decisionSaved")); setDecision(null); setComment(""); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const withdraw = useMutation({
    mutationFn: () => api(`/requests/${id}/withdraw`, { method: "POST" }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const choose = (action: Decision) => { setDecision(action); setComment(""); };

  if (detail.isLoading) return <PageLoader />;
  if (detail.isError || !detail.data) return <EmptyState>{i18n.language === "en" ? "This request is unavailable or you no longer have access." : "Questa richiesta non è disponibile o non hai più accesso."}</EmptyState>;
  const item = detail.data;
  const backPath = item.permissions.approvalContext ? "/approvals" : "/requests";
  const title = decision ? t(decisionKey(decision)) : "";

  return <div className="flex flex-col gap-8">
    <div>
      <Button variant="ghost" className="-ml-3 gap-2 text-muted-foreground" onClick={() => navigate(backPath)}>
        <ArrowLeft className="size-[17px] shrink-0" />{i18n.language === "en" ? "Back" : "Indietro"}
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">{i18n.language === "en" ? "Request details" : "Dettaglio della richiesta"}</p>
      <h1 className="text-[clamp(1.65rem,2.5vw,2.15rem)] leading-tight font-bold">{i18n.language === "en" ? item.absenceTypeLabelEn : item.absenceTypeLabelIt}</h1>
    </div>

    <RequestRow item={item} />

    <div className="flex flex-wrap justify-end gap-2">
      {item.permissions.canModify && <Button variant="secondary" onClick={() => navigate(`/new?revision=${item.id}`)}><Pencil className="size-4" />{i18n.language === "en" ? "Change" : "Modifica"}</Button>}
      {(item.permissions.canWithdraw || item.permissions.canRequestCancellation) && (
        <Button variant="ghost" className="text-destructive hover:text-destructive" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
          {item.permissions.canRequestCancellation ? t("cancelRequest") : t("withdraw")}
        </Button>
      )}
      {item.permissions.canDecide && <>
        <Button variant="secondary" className={toneSoftButton.red} onClick={() => choose("DECLINE")}><X className="size-[15px]" />{t("decline")}</Button>
        {item.overBalance && item.status === "PENDING_APPROVAL"
          ? <Button className={toneSolid.orange} onClick={() => choose("ESCALATE")}><ShieldCheck className="size-[15px]" />{t("escalate")}</Button>
          : <Button className={toneSolid.green} onClick={() => choose("APPROVE")}><Check className="size-[15px]" />{t("approve")}</Button>}
      </>}
    </div>

    <div className="grid gap-8 md:grid-cols-2">
      <section className="min-w-0">
        <SectionTitle>{i18n.language === "en" ? "Balance allocation" : "Ripartizione del saldo"}</SectionTitle>
        <Separator className="my-3" />
        {item.allocations.length ? (
          <div className="flex flex-col gap-2">
            {item.allocations.map((allocation) => (
              <div key={allocation.accountCode} className="flex items-center justify-between gap-3">
                <span>{allocation.accountCode.replace("_", " ")}</span>
                <strong className="font-bold"><Quantity amount={allocation.amount} unit={item.unit} /></strong>
              </div>
            ))}
          </div>
        ) : <p className="text-muted-foreground">{i18n.language === "en" ? "No balance allocation." : "Nessuna ripartizione del saldo."}</p>}
      </section>

      <section className="min-w-0">
        <SectionTitle>{i18n.language === "en" ? "Approval history" : "Cronologia dell'approvazione"}</SectionTitle>
        <Separator className="my-3" />
        <div className="flex flex-col gap-4">
          {item.decisions.map((entry) => (
            <div key={entry.id} className="request-history-entry">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{decisionLabel(entry.action, i18n.language)}</p>
                  <p className="text-sm text-muted-foreground">{entry.actorName} · {formatPortalDateTime(entry.createdAt, i18n.language)}</p>
                </div>
                <StatusBadge status={entry.toStatus} />
              </div>
              {entry.comment && <p className="mt-1.5 text-sm">{entry.comment}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>

    <Dialog open={Boolean(decision)} onOpenChange={(next) => { if (!next) setDecision(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {item.overBalance && (
          <Alert className={cn(toneSoft.orange, toneBorder.orange)}>
            <AlertCircleIcon />
            <AlertDescription className="text-current">{t("warningOver")}</AlertDescription>
          </Alert>
        )}
        <TextareaField
          label={i18n.language === "en" ? "Comment (optional)" : "Commento (facoltativo)"}
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setDecision(null)}>{i18n.language === "en" ? "Cancel" : "Annulla"}</Button>
          <Button className={toneSolid[decisionTone(decision)]} loading={decide.isPending} onClick={() => decision && decide.mutate(decision)}>{title}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
