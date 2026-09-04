import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { api, type BalanceSummary } from "../api";
import { EmptyState, PageHeading, PageLoader, Quantity } from "../components";
import { formatPortalDate } from "../request-calendar";
import { cn } from "@/lib/utils";
import { toneText } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Overview {
  accounts: Array<{ code: string; labelIt: string; labelEn: string; unit: "DAYS" | "MINUTES" }>;
  employees: Array<{
    id: string;
    employeeNumber: string;
    displayName: string;
    title: string | null;
    departmentName: string;
    status: "ACTIVE" | "INACTIVE";
    balances: BalanceSummary[];
  }>;
}

type Row = Overview["employees"][number];
type SortKey = "name" | "department" | string;
const PAGE_SIZES = ["25", "50", "100", "ALL"];

/** Available amounts sort with unknown balances (no snapshot) always last, whatever the direction. */
function compareRows(a: Row, b: Row, key: SortKey, direction: 1 | -1): number {
  const byName = a.displayName.localeCompare(b.displayName);
  if (key === "name") return byName * direction;
  if (key === "department") return (a.departmentName.localeCompare(b.departmentName) || byName) * direction;
  const left = a.balances.find((balance) => balance.code === key)?.available ?? null;
  const right = b.balances.find((balance) => balance.code === key)?.available ?? null;
  if (left === null && right === null) return byName;
  if (left === null) return 1;
  if (right === null) return -1;
  return (left - right) * direction || byName;
}

export function EmployeeBalances() {
  const { t, i18n } = useTranslation();
  const english = i18n.language === "en";
  const overview = useQuery({ queryKey: ["employee-balances"], queryFn: () => api<Overview>("/hr/employee-balances") });
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "name", direction: 1 });
  const [pageSize, setPageSize] = useState("50");
  const [page, setPage] = useState(0);

  if (overview.isLoading) return <PageLoader />;
  if (overview.isError || !overview.data) return <EmptyState>{t("overviewLoadFailed")}</EmptyState>;

  const { accounts, employees } = overview.data;
  const departments = [...new Set(employees.map((row) => row.departmentName))].sort((a, b) => a.localeCompare(b));
  const needle = search.trim().toLowerCase();
  const filtered = employees
    .filter((row) => status === "ALL" || row.status === "ACTIVE")
    .filter((row) => department === "ALL" || row.departmentName === department)
    .filter((row) => !needle || [row.displayName, row.employeeNumber, row.departmentName].some((value) => value.toLowerCase().includes(needle)))
    .sort((a, b) => compareRows(a, b, sort.key, sort.direction));

  const size = pageSize === "ALL" ? Math.max(filtered.length, 1) : Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * size, currentPage * size + size);
  const rangeFrom = filtered.length === 0 ? 0 : currentPage * size + 1;
  const rangeTo = Math.min(filtered.length, (currentPage + 1) * size);

  const resetPage = () => setPage(0);
  const toggleSort = (key: SortKey) => {
    setSort((previous) => (previous.key === key ? { key, direction: previous.direction === 1 ? -1 : 1 } : { key, direction: 1 }));
    resetPage();
  };

  const sortableHead = (key: SortKey, label: string, numeric = false) => (
    <TableHead key={key} aria-sort={sort.key === key ? (sort.direction === 1 ? "ascending" : "descending") : undefined} className={cn(numeric && "text-right")}>
      <Button variant="ghost" size="sm" className={cn("-mx-2.5 gap-1 font-semibold", numeric && "-mr-2.5 ml-auto flex")} onClick={() => toggleSort(key)}>
        {label}
        {sort.key === key ? (sort.direction === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
      </Button>
    </TableHead>
  );

  return <div className="flex flex-col gap-5">
    <PageHeading eyebrow="HR" title={t("employeeBalances")} />
    <div className="flex flex-wrap items-center gap-3">
      <Input
        value={search}
        onChange={(event) => { setSearch(event.target.value); resetPage(); }}
        placeholder={t("searchEmployees")}
        aria-label={t("searchEmployees")}
        className="w-full sm:max-w-[320px]"
      />
      <SelectField
        aria-label={t("department")}
        value={department}
        onChange={(value) => { setDepartment(value); resetPage(); }}
        data={[{ value: "ALL", label: t("allDepartments") }, ...departments.map((name) => ({ value: name, label: name }))]}
        size="sm"
        fieldClassName="w-auto"
        className="min-w-[180px]"
      />
      <SegmentedControl
        value={status}
        onChange={(value) => { setStatus(value); resetPage(); }}
        aria-label={t("status")}
        data={[
          { value: "ACTIVE", label: t("filterActive") },
          { value: "ALL", label: t("filterAll") },
        ]}
      />
    </div>
    <Card className="gap-0 overflow-hidden p-0">
      <ScrollArea className="w-full">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              {sortableHead("name", t("employee"))}
              {sortableHead("department", t("department"))}
              {accounts.map((account) => sortableHead(account.code, english ? account.labelEn : account.labelIt, true))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={2 + accounts.length} className="py-8 text-center text-muted-foreground">{t("noEmployeesMatch")}</TableCell></TableRow>
            )}
            {visible.map((row) => (
              <TableRow key={row.id} className={cn(row.status === "INACTIVE" && "opacity-60")}>
                <TableCell>
                  <p className="font-semibold">{row.displayName}</p>
                  <p className="text-xs text-muted-foreground">{row.employeeNumber}{row.title ? ` · ${row.title}` : ""}{row.status === "INACTIVE" ? ` · ${t("inactive")}` : ""}</p>
                </TableCell>
                <TableCell>{row.departmentName}</TableCell>
                {accounts.map((account) => {
                  const balance = row.balances.find((entry) => entry.code === account.code);
                  if (!balance || balance.available === null) {
                    return <TableCell key={account.code} className={cn("text-right", toneText.orange)} title={t("noBalance")}>—</TableCell>;
                  }
                  return (
                    <TableCell key={account.code} className="text-right" title={balance.asOf ? `${t("asOf")} ${formatPortalDate(balance.asOf, i18n.language)}` : undefined}>
                      <span className={cn("font-semibold", balance.stale && toneText.orange)}><Quantity amount={balance.available} unit={balance.unit} /></span>
                      {balance.pending > 0 && (
                        <p className="text-xs text-muted-foreground">{t("pending")}: <Quantity amount={balance.pending} unit={balance.unit} /></p>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{t("tableRange", { from: rangeFrom, to: rangeTo, total: filtered.length })}</span>
      <div className="flex items-center gap-3">
        <SelectField
          aria-label={t("rowsPerPage")}
          value={pageSize}
          onChange={(value) => { setPageSize(value); resetPage(); }}
          data={PAGE_SIZES.map((value) => ({ value, label: value === "ALL" ? t("allRows") : value }))}
          size="sm"
          fieldClassName="w-auto"
          className="min-w-[80px]"
        />
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("previousPage")}</Button>
          <Button variant="secondary" size="sm" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>{t("nextPage")}</Button>
        </div>
      </div>
    </div>
  </div>;
}
