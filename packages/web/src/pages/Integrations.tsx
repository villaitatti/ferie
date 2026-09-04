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
  email: { configured: boolean; pending: number; suppressed: number; directorDelegate: "NONE" | "CONFIGURED" | "MISSING" | "INACTIVE" };
  imports: { rejected: number };
}

export function Integrations() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ["integrations"], queryFn: () => api<Health>("/it/integrations"), refetchInterval: 60_000 });
  const sync = useMutation({
    mutationFn: () => api("/it/directory-sync", { method: "POST" }),
    onSuccess: async () => { toast.success(t("syncCompleted")); await queryClient.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  // MISSING/INACTIVE means the portal is suppressing the director's mail rather than delivering it,
  // and only an Employee Directory change can resolve that — so the SES tile must demand attention.
  const delegateWarning = health.data?.email.directorDelegate === "MISSING"
    ? t("delegateMissing")
    : health.data?.email.directorDelegate === "INACTIVE"
      ? t("delegateInactive")
      : null;
  const tiles = health.data ? [
    { title: "Employee Directory", icon: Database, ok: health.data.directory.lastSync?.status === "SUCCEEDED", detail: health.data.directory.lastSync ? `${t("employeeCount", { count: health.data.directory.lastSync.employeeCount })} · ${formatPortalDateTime(health.data.directory.lastSync.startedAt, i18n.language)}` : health.data.directory.configured ? t("notSynchronized") : t("notConfigured") },
    { title: "Auth0", icon: Shield, ok: health.data.auth0.configured || health.data.auth0.mode === "demo", detail: health.data.auth0.mode === "demo" ? "Demo authentication" : "JWT + current ED authorization" },
    { title: "AWS SES", icon: Mail, ok: health.data.email.configured && !delegateWarning, detail: [
      t("pendingNotifications", { count: health.data.email.pending }),
      health.data.email.suppressed > 0 ? t("suppressedNotifications", { count: health.data.email.suppressed }) : null,
      delegateWarning,
    ].filter(Boolean).join(" · ") },
    { title: "Zucchetti", icon: Cloud, ok: health.data.imports.rejected === 0, detail: t("rejectedBatches", { count: health.data.imports.rejected }) },
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
              {ok ? t("operational") : t("attention")}
            </Badge>
          </div>
          <p className="mt-6 font-bold">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </Card>
      ))}
    </div>
  </div>;
}
