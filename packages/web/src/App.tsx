import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, CalendarDays, CalendarRange, CheckSquare, Ellipsis, Gauge, Languages, LogOut, Moon, Network, Plus, Settings, Sun, Users, type LucideIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ItattiLogo } from "@/components/ItattiLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ComboboxField } from "@/components/ui/combobox-field";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const NewRequest = lazy(() => import("./pages/NewRequest").then((module) => ({ default: module.NewRequest })));
const Requests = lazy(() => import("./pages/Requests").then((module) => ({ default: module.Requests })));
const RequestDetail = lazy(() => import("./pages/RequestDetail").then((module) => ({ default: module.RequestDetail })));
const Approvals = lazy(() => import("./pages/Approvals").then((module) => ({ default: module.Approvals })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const EmployeeBalances = lazy(() => import("./pages/EmployeeBalances").then((module) => ({ default: module.EmployeeBalances })));
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

function PreferredLanguageSetting({ employee, available }: { employee: MeResponse["employee"]; available: boolean }) {
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
    <SelectField
      label={t("preferredLanguage")}
      description={!available ? t("preferredLanguageUnavailable") : update.isError ? t("preferredLanguageFailed") : t("preferredLanguageHint")}
      error={update.isError ? t("preferredLanguageFailed") : undefined}
      data={LANGUAGE_OPTIONS}
      value={employee.preferredLanguage}
      onChange={(value) => update.mutate(value as Language)}
      disabled={!available || update.isPending}
      size="sm"
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
  const changeIdentity = (next: string) => {
    if (!next) return;
    localStorage.setItem(DEMO_SUBJECT_KEY, next);
    void queryClient.invalidateQueries();
    navigate("/");
  };
  return (
    <ComboboxField
      label={t("rolePreview")}
      data={demoIdentityOptions(identities.data?.identities, subject)}
      value={subject}
      onChange={changeIdentity}
      emptyMessage={t("noIdentityMatches")}
      size="sm"
    />
  );
}

interface NavigationEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

// Dark text on the dark theme: the lifted destructive red only reaches ~3.6:1 against white,
// short of the 4.5:1 these small counters need (same treatment as toneSolid in lib/tone.ts).
function NavBadge({ value }: { value: number }) {
  return <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-bold text-white dark:text-neutral-950">{value}</span>;
}

function BrandMark() {
  return (
    <div className="grid size-9 shrink-0 place-items-center rounded-md bg-forest-800 text-white">
      <CalendarCheck2 className="size-[21px]" />
    </div>
  );
}

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={t("toggleTheme")} onClick={toggleTheme} />}>
        {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
      </TooltipTrigger>
      <TooltipContent>{t("toggleTheme")}</TooltipContent>
    </Tooltip>
  );
}

function AppSidebar({ entries, isActive, onNavigate }: { entries: NavigationEntry[]; isActive: (path: string) => boolean; onNavigate: (path: string) => void }) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();
  // Selecting a destination should also dismiss the mobile drawer.
  const go = (path: string) => {
    onNavigate(path);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={t("appName")} onClick={() => go("/")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-forest-800 text-white group-data-[collapsible=icon]:size-7">
                <CalendarCheck2 className="size-[18px]" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-base font-extrabold tracking-tight">{t("appName")}</span>
                <span className="truncate text-xs font-medium text-sidebar-foreground/60">Villa I Tatti</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* The bottom tab bar is the only other primary-navigation landmark and it is hidden on
            desktop, so the sidebar menu carries its own <nav> region for screen readers. */}
        <nav aria-label={t("mainNavigation")}>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {entries.map(({ path, label, icon: Icon, badge }) => (
                  <SidebarMenuItem key={path}>
                    <SidebarMenuButton
                      isActive={isActive(path)}
                      tooltip={label}
                      aria-current={isActive(path) ? "page" : undefined}
                      onClick={() => go(path)}
                      className={badge ? "pr-8" : undefined}
                    >
                      <Icon aria-hidden />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {badge ? <SidebarMenuBadge><NavBadge value={badge} /></SidebarMenuBadge> : null}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-0.5 border-t px-2 pt-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span>37.5h · Europe/Rome</span>
          <span>v{__APP_VERSION__}</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AppShell() {
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
        <p className="font-bold">{i18n.language === "en" ? "Access unavailable" : "Accesso non disponibile"}</p>
        <p className="text-muted-foreground">{me.error instanceof Error ? me.error.message : i18n.language === "en" ? "Your Employee Directory identity could not be loaded." : "Impossibile caricare l'identità da Employee Directory."}</p>
        {isDemoMode() && <div className="mt-5 max-w-[340px]"><DemoIdentitySwitcher /></div>}
      </main>
    );
  }

  const navigation: NavigationEntry[] = ([
    { path: "/", label: t("home"), icon: Gauge, show: true },
    { path: "/new", label: t("newRequest"), icon: Plus, show: true },
    { path: "/requests", label: t("requests"), icon: CalendarRange, show: true },
    { path: "/approvals", label: t("approvals"), icon: CheckSquare, show: me.data.capabilities.canApprove || me.data.capabilities.canFinalApprove, badge: me.data.pendingApprovals },
    { path: "/calendar", label: t("calendar"), icon: CalendarDays, show: true },
    { path: "/employees", label: t("employeeBalances"), icon: Users, show: me.data.capabilities.canViewEmployeeBalances },
    { path: "/admin", label: t("administration"), icon: Settings, show: me.data.capabilities.canAdminister },
    { path: "/integrations", label: t("integrations"), icon: Network, show: me.data.capabilities.canInspectIntegrations },
  ] satisfies Array<NavigationEntry & { show: boolean }>).filter((entry) => entry.show);

  // Temporary, this tab only. The durable preference lives in Employee Directory and is changed from
  // the profile menu.
  const selectLanguage = async (language: string) => {
    sessionStorage.setItem(SESSION_OVERRIDE_KEY, JSON.stringify({ employeeId: me.data.employee.id, language: languageFromCode(language) }));
    localStorage.setItem(LANGUAGE_CACHE_KEY, language);
    await i18n.changeLanguage(language);
  };

  const pathIsActive = (path: string) => location.pathname === path || (path === "/requests" && location.pathname.startsWith("/requests/"));
  const mobileNavigation = splitMobileNavigation(navigation);
  const mobileOverflowActive = mobileNavigation.overflow.some((entry) => entry.path === location.pathname);
  const mobileOverflowBadge = mobileNavigation.overflow.reduce((sum, entry) => sum + (entry.badge ?? 0), 0);
  const initials = me.data.employee.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2);

  return (
    <SidebarProvider>
      <AppSidebar entries={navigation} isActive={pathIsActive} onNavigate={navigate} />
      <SidebarInset>
        <header className="sticky top-0 z-40 h-16 shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="relative flex h-full items-center gap-3 px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              {/* On desktop the brand lives at the top of the sidebar; phones have no sidebar, so
                  the header carries it. */}
              <div className="flex min-w-0 items-center gap-3 md:hidden">
                <BrandMark />
                <div className="min-w-0">
                  <p className="leading-tight font-extrabold">{t("appName")}</p>
                  <p className="truncate text-xs text-muted-foreground">Villa I Tatti</p>
                </div>
              </div>
            </div>
            {/* Header centerpiece, shared with Libra: the institutional wordmark. True centering
                would collide with the flanking clusters below lg, so there the logo rejoins normal
                flow and centres in the leftover space; phones carry the Ferie brand instead. */}
            <div className="pointer-events-none hidden min-w-0 flex-1 justify-center md:flex lg:absolute lg:top-1/2 lg:left-1/2 lg:w-auto lg:flex-none lg:-translate-x-1/2 lg:-translate-y-1/2">
              <ItattiLogo className="h-6 w-auto shrink-0 text-foreground" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="ghost" size="icon" aria-label={t("language")} onClick={() => void selectLanguage(i18n.language === "en" ? "it" : "en")} />}
                >
                  <Languages className="size-5" />
                </TooltipTrigger>
                <TooltipContent>{t("language")}</TooltipContent>
              </Tooltip>
              <Popover>
                <PopoverTrigger
                  render={<button type="button" className="flex items-center gap-2.5 rounded-md p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" />}
                >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-forest-100 text-sm font-semibold text-forest-800 dark:bg-forest-900 dark:text-forest-100">{initials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[190px] flex-col sm:flex">
                      <strong className="truncate text-sm">{me.data.employee.displayName}</strong>
                      <small className="truncate text-xs text-muted-foreground">{me.data.employee.departmentName}</small>
                    </span>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 p-3">
                  <p className="px-1 pb-2 text-xs text-muted-foreground">{me.data.employee.email}</p>
                  <div className="flex flex-col gap-4">
                    <PreferredLanguageSetting employee={me.data.employee} available={me.data.capabilities.canChangePreferredLanguage} />
                    {isDemoMode() && <DemoIdentitySwitcher />}
                  </div>
                  <Separator className="my-3" />
                  <Button variant="ghost" className="w-full justify-start gap-2" onClick={signOut}>
                    <LogOut className="size-4" />{t("signOut")}
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* SidebarInset is already the page's <main>; `.page` owns the content padding itself. */}
        <div className="page">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard me={me.data} />} />
              <Route path="/new" element={<NewRequest me={me.data} />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/approvals" element={<Approvals />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/employees" element={me.data.capabilities.canViewEmployeeBalances ? <EmployeeBalances /> : <Navigate to="/" />} />
              <Route path="/admin" element={me.data.capabilities.canAdminister ? <Admin /> : <Navigate to="/" />} />
              <Route path="/integrations" element={me.data.capabilities.canInspectIntegrations ? <Integrations /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </div>
      </SidebarInset>

      <nav
        aria-label={t("mainNavigation")}
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {mobileNavigation.primary.map(({ path, label, icon: Icon, badge }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            aria-current={pathIsActive(path) ? "page" : undefined}
            className={cn("flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2", pathIsActive(path) ? "text-primary" : "text-muted-foreground")}
          >
            <span className="relative flex h-[22px] items-center">
              <Icon className="size-5" />
              {badge ? <span className="absolute -top-1.5 left-3.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white dark:text-neutral-950">{badge}</span> : null}
            </span>
            <small className="w-full text-center text-[10px] leading-[1.05] break-words">{label}</small>
          </button>
        ))}
        {mobileNavigation.overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={t("more")}
                  className={cn("flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2", mobileOverflowActive ? "text-primary" : "text-muted-foreground")}
                />
              }
            >
              <span className="relative flex h-[22px] items-center">
                <Ellipsis className="size-[22px]" />
                {mobileOverflowBadge ? <span className="absolute -top-1.5 left-3.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-none font-bold text-white dark:text-neutral-950">{mobileOverflowBadge}</span> : null}
              </span>
              <small className="text-[10px] leading-[1.05]">{t("more")}</small>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              {mobileNavigation.overflow.map(({ path, label, icon: Icon, badge }) => (
                <DropdownMenuItem key={path} onSelect={() => navigate(path)} className={cn(pathIsActive(path) && "text-primary")}>
                  <Icon className="size-[18px]" />
                  <span className="flex-1">{label}</span>
                  {badge ? <NavBadge value={badge} /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </nav>
    </SidebarProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
