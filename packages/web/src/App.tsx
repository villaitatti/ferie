import { ActionIcon, AppShell, Avatar, Burger, Group, Menu, NavLink, Select, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, CalendarDays, CalendarRange, CheckSquare, Ellipsis, Gauge, Languages, LogOut, Network, Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import type { Language } from "@ferie/shared";
import { api, type DevIdentity, type MeResponse } from "./api";
import { usePortalSession } from "./auth";
import { PageLoader } from "./components";
import { currentDemoSubject, DEMO_SUBJECT_KEY, demoIdentityOptions, isDemoMode } from "./demo-identity";
import { LANGUAGE_CACHE_KEY, languageCode, languageFromCode, LANGUAGE_OPTIONS, readSessionOverride, resolveLanguage, SESSION_OVERRIDE_KEY } from "./language";
import { splitMobileNavigation } from "./mobile-navigation";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const NewRequest = lazy(() => import("./pages/NewRequest").then((module) => ({ default: module.NewRequest })));
const Requests = lazy(() => import("./pages/Requests").then((module) => ({ default: module.Requests })));
const RequestDetail = lazy(() => import("./pages/RequestDetail").then((module) => ({ default: module.RequestDetail })));
const Approvals = lazy(() => import("./pages/Approvals").then((module) => ({ default: module.Approvals })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const Integrations = lazy(() => import("./pages/Integrations").then((module) => ({ default: module.Integrations })));

/**
 * Applies the Employee Directory preference on every load, unless this tab has switched language for
 * the same employee with the header control.
 */
function useInterfaceLanguage(employee: MeResponse["employee"] | undefined) {
  const { i18n } = useTranslation();
  useEffect(() => {
    if (!employee) return;
    const target = languageCode(resolveLanguage(employee.id, employee.preferredLanguage, readSessionOverride()));
    if (i18n.language === target) return;
    localStorage.setItem(LANGUAGE_CACHE_KEY, target);
    void i18n.changeLanguage(target);
  }, [employee, i18n]);
}

function PreferredLanguageSetting({ employee }: { employee: MeResponse["employee"] }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (language: Language) => api<{ preferredLanguage: Language }>("/me/preferred-language", { method: "PATCH", body: JSON.stringify({ preferredLanguage: language }) }),
    onSuccess: async (result) => {
      // The durable choice supersedes any temporary switch made in this tab.
      sessionStorage.removeItem(SESSION_OVERRIDE_KEY);
      const code = languageCode(result.preferredLanguage);
      localStorage.setItem(LANGUAGE_CACHE_KEY, code);
      await i18n.changeLanguage(code);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
  return (
    <Select
      label={t("preferredLanguage")}
      description={update.isError ? t("preferredLanguageFailed") : t("preferredLanguageHint")}
      error={update.isError}
      data={LANGUAGE_OPTIONS}
      value={employee.preferredLanguage}
      onChange={(value) => { if (value) update.mutate(value as Language); }}
      disabled={update.isPending}
      allowDeselect={false}
      size="xs"
    />
  );
}

function DemoIdentitySwitcher() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const identities = useQuery({
    queryKey: ["demo-identities"],
    queryFn: () => api<{ identities: DevIdentity[] }>("/demo-identities"),
    staleTime: 60_000,
    retry: false,
  });
  const subject = currentDemoSubject();
  const changeIdentity = (next: string | null) => {
    if (!next) return;
    localStorage.setItem(DEMO_SUBJECT_KEY, next);
    void queryClient.invalidateQueries();
    navigate("/");
  };
  return (
    <Select
      label={t("rolePreview")}
      data={demoIdentityOptions(identities.data?.identities, subject)}
      value={subject}
      onChange={changeIdentity}
      searchable
      limit={50}
      nothingFoundMessage={t("noIdentityMatches")}
      size="xs"
    />
  );
}

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = usePortalSession();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me") });
  useInterfaceLanguage(me.data?.employee);
  if (me.isLoading) return <main className="boot-loader"><PageLoader /></main>;
  if (me.isError || !me.data) {
    return (
      <main className="boot-error">
        <Text fw={700}>{i18n.language === "en" ? "Access unavailable" : "Accesso non disponibile"}</Text>
        <Text c="dimmed">{me.error instanceof Error ? me.error.message : i18n.language === "en" ? "Your Employee Directory identity could not be loaded." : "Impossibile caricare l'identità da Employee Directory."}</Text>
        {isDemoMode() && <div className="boot-error-identity"><DemoIdentitySwitcher /></div>}
      </main>
    );
  }

  const navigation = [
    { path: "/", label: t("home"), icon: Gauge, show: true },
    { path: "/new", label: t("newRequest"), icon: Plus, show: true },
    { path: "/requests", label: t("requests"), icon: CalendarRange, show: true },
    { path: "/approvals", label: t("approvals"), icon: CheckSquare, show: me.data.capabilities.canApprove || me.data.capabilities.canFinalApprove, badge: me.data.pendingApprovals },
    { path: "/calendar", label: t("calendar"), icon: CalendarDays, show: true },
    { path: "/admin", label: t("administration"), icon: Settings, show: me.data.capabilities.canAdminister },
    { path: "/integrations", label: t("integrations"), icon: Network, show: me.data.capabilities.canInspectIntegrations },
  ].filter((entry) => entry.show);

  // Temporary, this tab only. The durable preference lives in Employee Directory and is changed from
  // the profile menu.
  const selectLanguage = async (language: string) => {
    sessionStorage.setItem(SESSION_OVERRIDE_KEY, JSON.stringify({ employeeId: me.data.employee.id, language: languageFromCode(language) }));
    localStorage.setItem(LANGUAGE_CACHE_KEY, language);
    await i18n.changeLanguage(language);
  };

  const pathIsActive = (path: string) => location.pathname === path || (path === "/requests" && location.pathname.startsWith("/requests/"));
  const nav = navigation.map(({ path, label, icon: Icon, badge }) => (
    <NavLink key={path} label={label} leftSection={<Icon size={19} />} rightSection={badge ? <span className="nav-badge">{badge}</span> : undefined} active={pathIsActive(path)} onClick={() => { navigate(path); close(); }} />
  ));
  const mobileNavigation = splitMobileNavigation(navigation);
  const mobileOverflowActive = mobileNavigation.overflow.some((entry) => entry.path === location.pathname);
  const mobileOverflowBadge = mobileNavigation.overflow.reduce((sum, entry) => sum + (entry.badge ?? 0), 0);

  return (
    <AppShell header={{ height: 64 }} navbar={{ width: 244, breakpoint: "sm", collapsed: { mobile: !opened } }} padding={0}>
      <AppShell.Header className="app-header">
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm"><Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" /><div className="brand-mark"><CalendarCheck2 size={21} /></div><div><Text fw={800} lh={1.1}>{t("appName")}</Text><Text size="xs" c="dimmed">Villa I Tatti</Text></div></Group>
          <Group gap="xs">
            <Tooltip label={t("language")}><ActionIcon variant="subtle" color="gray" onClick={() => void selectLanguage(i18n.language === "en" ? "it" : "en")} aria-label={t("language")}><Languages size={20} /></ActionIcon></Tooltip>
            <Menu position="bottom-end" width={260}>
              <Menu.Target><button className="profile-button"><Avatar size={34} color="forest">{me.data.employee.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</Avatar><span className="profile-copy"><strong>{me.data.employee.displayName}</strong><small>{me.data.employee.departmentName}</small></span></button></Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{me.data.employee.email}</Menu.Label>
                <Menu.Item closeMenuOnClick={false}><PreferredLanguageSetting employee={me.data.employee} /></Menu.Item>
                {isDemoMode() && <Menu.Item closeMenuOnClick={false}><DemoIdentitySwitcher /></Menu.Item>}
                <Menu.Divider />
                <Menu.Item leftSection={<LogOut size={16} />} onClick={signOut}>{t("signOut")}</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm" className="desktop-nav">
        <div className="nav-stack">{nav}</div>
        <div className="sidebar-footer">
          <Text size="xs" c="dimmed">37.5h · Europe/Rome</Text>
          <Text size="xs" c="dimmed">v{__APP_VERSION__}</Text>
        </div>
      </AppShell.Navbar>
      <AppShell.Main><main className="page"><Suspense fallback={<PageLoader />}><Routes>
        <Route path="/" element={<Dashboard me={me.data} />} />
        <Route path="/new" element={<NewRequest me={me.data} />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/admin" element={me.data.capabilities.canAdminister ? <Admin /> : <Navigate to="/" />} />
        <Route path="/integrations" element={me.data.capabilities.canInspectIntegrations ? <Integrations /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes></Suspense></main></AppShell.Main>
      <nav className="mobile-nav" aria-label={i18n.language === "en" ? "Primary navigation" : "Navigazione principale"}>
        {mobileNavigation.primary.map(({ path, label, icon: Icon, badge }) => <button key={path} className={pathIsActive(path) ? "active" : ""} onClick={() => navigate(path)}><span><Icon size={20} />{badge ? <i>{badge}</i> : null}</span><small>{label}</small></button>)}
        {mobileNavigation.overflow.length > 0 && <Menu position="top-end" width={230} withinPortal>
          <Menu.Target><button className={mobileOverflowActive ? "active" : ""} aria-label={t("more")}><span><Ellipsis size={22} />{mobileOverflowBadge ? <i>{mobileOverflowBadge}</i> : null}</span><small>{t("more")}</small></button></Menu.Target>
          <Menu.Dropdown>
            {mobileNavigation.overflow.map(({ path, label, icon: Icon, badge }) => <Menu.Item key={path} leftSection={<Icon size={18} />} rightSection={badge ? <span className="nav-badge">{badge}</span> : undefined} color={pathIsActive(path) ? "forest" : undefined} onClick={() => navigate(path)}>{label}</Menu.Item>)}
          </Menu.Dropdown>
        </Menu>}
      </nav>
    </AppShell>
  );
}
