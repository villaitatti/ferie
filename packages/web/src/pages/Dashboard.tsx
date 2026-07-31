import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { api, type MeResponse, type RequestListItem } from "../api";
import { BalanceTile, EmptyState, PageHeading, PageLoader, RequestRow, SectionTitle } from "../components";
import { Button } from "@/components/ui/button";

export function Dashboard({ me }: { me: MeResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requests = useQuery({ queryKey: ["requests"], queryFn: () => api<RequestListItem[]>("/requests") });
  const upcoming = requests.data?.filter((entry) => entry.status === "APPROVED" && entry.endDate >= new Date().toISOString().slice(0, 10)).slice(0, 3) ?? [];

  return <div className="flex flex-col gap-8">
    <PageHeading eyebrow={me.employee.departmentName} title={`${t("greeting")}, ${me.employee.displayName.split(" ")[0]}`}>
      <Button onClick={() => navigate("/new")}><Plus className="size-[18px]" />{t("newRequest")}</Button>
    </PageHeading>

    <section>
      <SectionTitle className="mb-3">{t("balances")}</SectionTitle>
      <div className="grid gap-4 min-[36em]:grid-cols-2 lg:grid-cols-3">
        {me.balances.map((balance) => <BalanceTile key={balance.code} balance={balance} />)}
      </div>
    </section>

    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle>{t("upcoming")}</SectionTitle>
        <Button variant="ghost" onClick={() => navigate("/requests")}>{t("requests")}<ArrowRight className="size-4" /></Button>
      </div>
      {requests.isLoading
        ? <PageLoader />
        : upcoming.length
          ? <div className="flex flex-col gap-3">{upcoming.map((item) => <RequestRow key={item.id} item={item} />)}</div>
          : <EmptyState action={{ label: t("newRequest"), onClick: () => navigate("/new") }}>{t("noUpcoming")}</EmptyState>}
    </section>
  </div>;
}
