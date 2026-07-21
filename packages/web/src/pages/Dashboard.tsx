import { Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, type MeResponse, type RequestListItem } from "../api";
import { BalanceTile, EmptyState, PageLoader, RequestRow } from "../components";

export function Dashboard({ me }: { me: MeResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => api<RequestListItem[]>("/requests") });
  const upcoming = requests.data?.filter((entry) => entry.status === "APPROVED" && entry.endDate >= new Date().toISOString().slice(0, 10)).slice(0, 3) ?? [];
  return <Stack gap="xl">
    <Group justify="space-between" align="flex-end">
      <div><Text size="sm" c="dimmed">{me.employee.departmentName}</Text><Title order={1}>{t("greeting")}, {me.employee.displayName.split(" ")[0]}</Title></div>
      <Button leftSection={<Plus size={18} />} onClick={() => navigate("/new")}>{t("newRequest")}</Button>
    </Group>
    <section><Group justify="space-between" mb="sm"><Title order={2}>{t("balances")}</Title></Group><SimpleGrid cols={{ base: 1, xs: 2, lg: 3 }}>{me.balances.map((balance) => <BalanceTile key={balance.code} balance={balance} />)}</SimpleGrid></section>
    <section><Group justify="space-between" mb="sm"><Title order={2}>{t("upcoming")}</Title><Button variant="subtle" rightSection={<ArrowRight size={16} />} onClick={() => navigate("/requests")}>{t("requests")}</Button></Group>
      {requests.isLoading ? <PageLoader /> : upcoming.length ? <Stack gap="sm">{upcoming.map((item) => <RequestRow key={item.id} item={item} />)}</Stack> : <EmptyState action={{ label: t("newRequest"), onClick: () => navigate("/new") }}>{t("noUpcoming")}</EmptyState>}
    </section>
  </Stack>;
}
