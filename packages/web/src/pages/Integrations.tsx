import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Database, Mail, RefreshCw, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../api";

interface Health { directory: { configured: boolean; lastSync: { status: string; startedAt: string; employeeCount: number; errorCode?: string } | null }; auth0: { configured: boolean; mode: string }; email: { configured: boolean; pending: number }; imports: { rejected: number } }

export function Integrations() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const health = useQuery({ queryKey: ["integrations"], queryFn: () => api<Health>("/it/integrations"), refetchInterval: 60_000 });
  const sync = useMutation({ mutationFn: () => api("/it/directory-sync", { method: "POST" }), onSuccess: async () => { toast.success(i18n.language === "en" ? "ED sync completed" : "Sincronizzazione ED completata"); await queryClient.invalidateQueries({ queryKey: ["integrations"] }); }, onError: (error: Error) => toast.error(error.message) });
  const tiles = health.data ? [
    { title: "Employee Directory", icon: Database, ok: health.data.directory.lastSync?.status === "SUCCEEDED", detail: health.data.directory.lastSync ? `${health.data.directory.lastSync.employeeCount} ${i18n.language === "en" ? "employees" : "dipendenti"} · ${new Date(health.data.directory.lastSync.startedAt).toLocaleString(i18n.language)}` : health.data.directory.configured ? (i18n.language === "en" ? "Not synchronized" : "Non sincronizzato") : (i18n.language === "en" ? "Not configured" : "Non configurato") },
    { title: "Auth0", icon: Shield, ok: health.data.auth0.configured || health.data.auth0.mode === "demo", detail: health.data.auth0.mode === "demo" ? "Demo authentication" : "JWT + current ED authorization" },
    { title: "AWS SES", icon: Mail, ok: health.data.email.configured, detail: `${health.data.email.pending} ${i18n.language === "en" ? "pending notifications" : "notifiche in attesa"}` },
    { title: "Zucchetti", icon: Cloud, ok: health.data.imports.rejected === 0, detail: `${health.data.imports.rejected} ${i18n.language === "en" ? "rejected batches" : "importazioni rifiutate"}` },
  ] : [];
  return <Stack gap="lg"><Group justify="space-between" align="flex-end"><div><Text size="sm" c="dimmed">Operations</Text><Title order={1}>{t("integrationHealth")}</Title></div><Button leftSection={<RefreshCw size={17} />} disabled={!health.data?.directory.configured} loading={sync.isPending} onClick={() => sync.mutate()}>{t("syncNow")}</Button></Group><SimpleGrid cols={{ base: 1, sm: 2 }}>{tiles.map(({ title, icon: Icon, ok, detail }) => <Paper key={title} withBorder p="lg" className="integration-tile"><Group justify="space-between"><Icon size={22} /><Badge color={ok ? "green" : "orange"}>{ok ? (i18n.language === "en" ? "Operational" : "Operativo") : (i18n.language === "en" ? "Attention" : "Attenzione")}</Badge></Group><Text fw={700} mt="lg">{title}</Text><Text size="sm" c="dimmed">{detail}</Text></Paper>)}</SimpleGrid></Stack>;
}
