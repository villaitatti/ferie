import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Database, Mail, RefreshCw, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "../api";
import { PageHeading } from "../components";
import { formatPortalDateTime } from "../request-calendar";
import { cn } from "@/lib/utils";
import { toneSoft } from "@/lib/tone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Health {
  directory: { configured: boolean; lastSync: { status: string; startedAt: string; employeeCount: number; errorCode?: string } | null };
  auth0: { configured: boolean; mode: string };
  email: { configured: boolean; pending: number };
  imports: { rejected: number };
}

export function Integrations() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ["integrations"], queryFn: () => api<Health>("/it/integrations"), refetchInterval: 60_000 });
  const sync = useMutation({
    mutationFn: () => api("/it/directory-sync", { method: "POST" }),
    onSuccess: async () => { toast.success(i18n.language === "en" ? "ED sync completed" : "Sincronizzazione ED completata"); await queryClient.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const tiles = health.data ? [
    { title: "Employee Directory", icon: Database, ok: health.data.directory.lastSync?.status === "SUCCEEDED", detail: health.data.directory.lastSync ? `${health.data.directory.lastSync.employeeCount} ${i18n.language === "en" ? "employees" : "dipendenti"} · ${formatPortalDateTime(health.data.directory.lastSync.startedAt, i18n.language)}` : health.data.directory.configured ? (i18n.language === "en" ? "Not synchronized" : "Non sincronizzato") : (i18n.language === "en" ? "Not configured" : "Non configurato") },
    { title: "Auth0", icon: Shield, ok: health.data.auth0.configured || health.data.auth0.mode === "demo", detail: health.data.auth0.mode === "demo" ? "Demo authentication" : "JWT + current ED authorization" },
    { title: "AWS SES", icon: Mail, ok: health.data.email.configured, detail: `${health.data.email.pending} ${i18n.language === "en" ? "pending notifications" : "notifiche in attesa"}` },
    { title: "Zucchetti", icon: Cloud, ok: health.data.imports.rejected === 0, detail: `${health.data.imports.rejected} ${i18n.language === "en" ? "rejected batches" : "importazioni rifiutate"}` },
  ] : [];

  return <div className="flex flex-col gap-5">
    <PageHeading eyebrow="Operations" title={t("integrationHealth")}>
      <Button disabled={!health.data?.directory.configured || sync.isPending} onClick={() => sync.mutate()}>
        <RefreshCw className={cn("size-[17px]", sync.isPending && "animate-spin")} />{t("syncNow")}
      </Button>
    </PageHeading>
    <div className="grid gap-4 sm:grid-cols-2">
      {tiles.map(({ title, icon: Icon, ok, detail }) => (
        <Card key={title} className="integration-tile gap-0 p-6">
          <div className="flex items-start justify-between gap-3">
            <Icon className="size-[22px] text-muted-foreground" />
            <Badge variant="ghost" className={toneSoft[ok ? "green" : "orange"]}>
              {ok ? (i18n.language === "en" ? "Operational" : "Operativo") : (i18n.language === "en" ? "Attention" : "Attenzione")}
            </Badge>
          </div>
          <p className="mt-6 font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </Card>
      ))}
    </div>
  </div>;
}
