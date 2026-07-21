import { ActionIcon, AppShell, Avatar, Burger, Group, Menu, NavLink, Select, Text, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, CalendarDays, CalendarRange, CheckSquare, Gauge, Languages, LogOut, Network, Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { api, type MeResponse } from "./api";
import { PageLoader } from "./components";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const NewRequest = lazy(() => import("./pages/NewRequest").then((module) => ({ default: module.NewRequest })));
const Requests = lazy(() => import("./pages/Requests").then((module) => ({ default: module.Requests })));
const Approvals = lazy(() => import("./pages/Approvals").then((module) => ({ default: module.Approvals })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const Integrations = lazy(() => import("./pages/Integrations").then((module) => ({ default: module.Integrations })));

const demoUsers = [
  { value: "auth0|demo-employee", label: "Andrea · Staff" },
  { value: "auth0|demo-approver", label: "Elena · Pre-approver" },
  { value: "auth0|demo-responsible", label: "Marco · HOD" },
  { value: "auth0|demo-final", label: "Giulia · HR / Final" },
  { value: "auth0|demo-it", label: "Luca · IT" },
];

export function App() {
  const [opened, { toggle, close }] = useDisclosure();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/me") });
  if (me.isLoading) return <main className="boot-loader"><PageLoader /></main>;
  if (me.isError || !me.data) return <main className="boot-error"><Text fw={700}>{i18n.language === "en" ? "Access unavailable" : "Accesso non disponibile"}</Text><Text c="dimmed">{me.error instanceof Error ? me.error.message : i18n.language === "en" ? "Your Employee Directory identity could not be loaded." : "Impossibile caricare l'identità da Employee Directory."}</Text></main>;

  const navigation = [
    { path: "/", label: t("home"), icon: Gauge, show: true },
    { path: "/new", label: t("newRequest"), icon: Plus, show: true },
    { path: "/requests", label: t("requests"), icon: CalendarRange, show: true },
    { path: "/approvals", label: t("approvals"), icon: CheckSquare, show: me.data.capabilities.canApprove || me.data.capabilities.canFinalApprove, badge: me.data.pendingApprovals },
    { path: "/calendar", label: t("calendar"), icon: CalendarDays, show: true },
    { path: "/admin", label: t("administration"), icon: Settings, show: me.data.capabilities.canAdminister },
    { path: "/integrations", label: t("integrations"), icon: Network, show: me.data.capabilities.canInspectIntegrations },
  ].filter((entry) => entry.show);

  const selectLanguage = async (language: string) => { localStorage.setItem("ferie-language", language); await i18n.changeLanguage(language); };
  const changeDemo = (subject: string | null) => {
    if (!subject) return;
    localStorage.setItem("ferie-demo-subject", subject);
    void queryClient.invalidateQueries();
    navigate("/");
  };

  const nav = navigation.map(({ path, label, icon: Icon, badge }) => (
    <NavLink key={path} label={label} leftSection={<Icon size={19} />} rightSection={badge ? <span className="nav-badge">{badge}</span> : undefined} active={location.pathname === path} onClick={() => { navigate(path); close(); }} />
  ));

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
                {import.meta.env.VITE_AUTH_DISABLED !== "false" && <Menu.Item closeMenuOnClick={false}><Select label={t("rolePreview")} data={demoUsers} value={localStorage.getItem("ferie-demo-subject") ?? "auth0|demo-employee"} onChange={changeDemo} size="xs" /></Menu.Item>}
                <Menu.Divider />
                <Menu.Item leftSection={<LogOut size={16} />} disabled>{t("signOut")}</Menu.Item>
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
        <Route path="/requests/:id" element={<Requests />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/admin" element={me.data.capabilities.canAdminister ? <Admin /> : <Navigate to="/" />} />
        <Route path="/integrations" element={me.data.capabilities.canInspectIntegrations ? <Integrations /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes></Suspense></main></AppShell.Main>
      <nav className="mobile-nav">{navigation.slice(0, 5).map(({ path, label, icon: Icon, badge }) => <button key={path} className={location.pathname === path ? "active" : ""} onClick={() => navigate(path)}><span><Icon size={20} />{badge ? <i>{badge}</i> : null}</span><small>{label}</small></button>)}</nav>
    </AppShell>
  );
}
