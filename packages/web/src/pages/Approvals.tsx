import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, Check, MessageSquare, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api, type RequestListItem } from "../api";
import { EmptyState, PageHeading, PageLoader, RequestRow } from "../components";
import { cn } from "@/lib/utils";
import { type Decision, decisionKey, decisionTone } from "@/lib/decisions";
import { toneBorder, toneSoft, toneSoftButton, toneSolid } from "@/lib/tone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/text-field";

export function Approvals() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const approvals = useQuery({ queryKey: ["approvals"], queryFn: () => api<RequestListItem[]>("/approvals") });
  const [selection, setSelection] = useState<{ item: RequestListItem; action: Decision } | null>(null);
  const [comment, setComment] = useState("");
  const decide = useMutation({
    mutationFn: ({ item, action }: NonNullable<typeof selection>) => api(`/requests/${item.id}/decision`, { method: "POST", body: JSON.stringify({ action, comment: comment || undefined, expectedStatus: item.status }) }),
    onSuccess: async () => { toast.success(t("decisionSaved")); setSelection(null); setComment(""); await queryClient.invalidateQueries(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const choose = (item: RequestListItem, action: Decision) => { setSelection({ item, action }); setComment(""); };
  const title = selection ? t(decisionKey(selection.action)) : "";

  return <div className="flex flex-col gap-5">
    <PageHeading eyebrow="Workflow" title={t("approvals")} />
    <Alert className={cn(toneSoft.blue, toneBorder.blue)}>
      <MessageSquare />
      <AlertDescription className="text-current">{t("staffing")}</AlertDescription>
    </Alert>

    {approvals.isLoading ? <PageLoader /> : approvals.data?.length ? (
      <div className="flex flex-col gap-3">
        {approvals.data.map((item) => (
          <RequestRow key={item.id} item={item} actions={<>
            <Button size="sm" variant="secondary" className={toneSoftButton.red} onClick={() => choose(item, "DECLINE")}><X className="size-[15px]" />{t("decline")}</Button>
            {item.overBalance && item.status === "PENDING_APPROVAL"
              ? <Button size="sm" className={toneSolid.orange} onClick={() => choose(item, "ESCALATE")}><ShieldCheck className="size-[15px]" />{t("escalate")}</Button>
              : <Button size="sm" className={toneSolid.green} onClick={() => choose(item, "APPROVE")}><Check className="size-[15px]" />{t("approve")}</Button>}
          </>} />
        ))}
      </div>
    ) : <EmptyState>{i18n.language === "en" ? "No requests require your decision." : "Nessuna richiesta richiede una decisione."}</EmptyState>}

    <Dialog open={Boolean(selection)} onOpenChange={(next) => { if (!next) setSelection(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {selection?.item.overBalance && (
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
          <Button variant="outline" onClick={() => setSelection(null)}>{i18n.language === "en" ? "Cancel" : "Annulla"}</Button>
          <Button className={toneSolid[decisionTone(selection?.action ?? null)]} loading={decide.isPending} onClick={() => selection && decide.mutate(selection)}>{title}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
