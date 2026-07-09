import { useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useI18n, LANGUAGES, type LangCode } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Users, Calendar, ClipboardCheck, MessagesSquare,
  CreditCard, Megaphone, Bell, LogOut, BarChart3, User as UserIcon, Kanban, Layers,
  GraduationCap, TrendingUp, UserPlus, Upload, LineChart, Settings, QrCode,
  Sun, Moon, Languages, Menu,
} from "lucide-react";
import faviconUrl from "@/assets/favicon.svg";
import logoSyncletics from "@/assets/logo-syncletics.svg";
import logoSyncleticsWhite from "@/assets/logo-syncletics-white.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MessagesPopover, AnnouncementsPopover, NotificationsPopover, AlertsPopover } from "@/components/HeaderQuickViews";
import { useAvatar } from "@/lib/user-settings";
import { hapticTick } from "@/lib/native";


type NavItem = { to: string; labelKey: string; icon: typeof Users };
type NavSection = { labelKey: string | null; items: NavItem[] };

const adminSections: NavSection[] = [
  {
    labelKey: null,
    items: [{ to: "/app/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "sec.people",
    items: [
      { to: "/app/members", labelKey: "nav.members", icon: Users },
      { to: "/app/groups", labelKey: "nav.groups", icon: Layers },
      { to: "/app/courses", labelKey: "nav.courses", icon: GraduationCap },
      { to: "/app/progress", labelKey: "nav.progress", icon: LineChart },
      { to: "/app/import", labelKey: "nav.import", icon: Upload },
    ],
  },
  {
    labelKey: "sec.operations",
    items: [
      { to: "/app/schedule", labelKey: "nav.schedule", icon: Calendar },
      { to: "/app/attendance", labelKey: "nav.attendance", icon: ClipboardCheck },
      { to: "/app/stats", labelKey: "nav.stats", icon: BarChart3 },
    ],
  },
  {
    labelKey: "sec.money",
    items: [
      { to: "/app/billing", labelKey: "nav.billing", icon: CreditCard },
      { to: "/app/revenue", labelKey: "nav.revenue", icon: TrendingUp },
    ],
  },
  {
    labelKey: "sec.growth",
    items: [
      { to: "/app/leads", labelKey: "nav.leads", icon: UserPlus },
      { to: "/app/pipeline", labelKey: "nav.pipeline", icon: Kanban },
    ],
  },
  {
    labelKey: "sec.communication",
    items: [
      { to: "/app/chat", labelKey: "nav.chat", icon: MessagesSquare },
      { to: "/app/announcements", labelKey: "nav.announcements", icon: Megaphone },
      { to: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
  {
    labelKey: "sec.account",
    items: [
      { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
      { to: "/app/profile", labelKey: "nav.profile", icon: UserIcon },
    ],
  },
];

const memberSections: NavSection[] = [
  {
    labelKey: null,
    items: [
      { to: "/app/dashboard", labelKey: "nav.home", icon: LayoutDashboard },
      { to: "/app/profile", labelKey: "nav.profile", icon: UserIcon },
      { to: "/app/schedule", labelKey: "nav.schedule", icon: Calendar },
      { to: "/app/chat", labelKey: "nav.chat", icon: MessagesSquare },
      { to: "/app/billing", labelKey: "nav.billing", icon: CreditCard },
      { to: "/app/announcements", labelKey: "nav.announcements", icon: Megaphone },
      { to: "/app/notifications", labelKey: "nav.notifications", icon: Bell },
    ],
  },
];

const bottomTabs: NavItem[] = [
  { to: "/app/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/app/schedule", labelKey: "nav.calendar", icon: Calendar },
  { to: "/app/chat", labelKey: "nav.chat", icon: MessagesSquare },
  { to: "/app/progress", labelKey: "nav.progress", icon: LineChart },
];

const moreTabs: NavItem[] = [
  { to: "/app/billing", labelKey: "nav.billingRevenue", icon: CreditCard },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, membership, club, isStaff, profile, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
    if (!loading && user && !membership) navigate({ to: "/onboarding" });
  }, [loading, user, membership, navigate]);

  if (loading || !user || !membership || !club) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const sections = isStaff ? adminSections : memberSections;
  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const pageTitle = (() => {
    const all = [...adminSections, ...memberSections].flatMap((s) => s.items).concat(moreTabs);
    const hit = all.find((i) => i.to === pathname);
    return hit ? t(hit.labelKey) : club.name;
  })();

  const ThemeToggle = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground", className)}
      aria-label="Toggle dark mode"
      title={resolvedTheme === "dark" ? t("theme.light") : t("theme.dark")}
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  const LanguageMenu = ({ compact }: { compact?: boolean }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={t("common.language")}
            title={t("common.language")}
          >
            <Languages className="h-4 w-4" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="h-8 w-full justify-start gap-2" aria-label={t("common.language")}>
            <Languages className="h-3.5 w-3.5" />
            <span className="text-xs">{currentLang.flag} {currentLang.label}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as LangCode)}
            className={cn("gap-2", lang === l.code && "bg-accent font-medium")}
          >
            <span>{l.flag}</span> {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const UserBubble = ({ size, fallbackClass }: { size: string; fallbackClass: string }) => {
    const avatar = useAvatar(user.id, profile?.avatar_url ?? null);
    const initial = profile?.display_name?.[0]?.toUpperCase() ?? "?";
    return avatar ? (
      <img src={avatar} alt={profile?.display_name ?? "Profile"} className={cn(size, "shrink-0 rounded-full object-cover")} />
    ) : (
      <div className={cn(size, "grid shrink-0 place-items-center rounded-full", fallbackClass)}>{initial}</div>
    );
  };

  const NavList = () => (
    <nav className="space-y-4">
      {sections.map((section, i) => (
        <div key={section.labelKey ?? i}>
          {section.labelKey && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t(section.labelKey)}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                    // Announcements live in the header bell on mobile.
                    item.to === "/app/announcements" && "hidden lg:flex"
                  )}
                >
                  <item.icon className="h-4 w-4" /> {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 grid h-[calc(3.5rem+env(safe-area-inset-top))] grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/app/dashboard" className="flex items-center justify-center" aria-label="Dashboard">
          <img src={faviconUrl} alt="Syncletics" className="h-7 w-7 dark:invert" />
        </Link>
        <div className="justify-self-end">
          <AlertsPopover />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 pt-[calc(1rem+env(safe-area-inset-top))] transition-transform lg:static lg:translate-x-0 lg:pt-4",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Link to="/app/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <img src={logoSyncletics} alt="Syncletics" className="h-7 w-auto dark:hidden" />
            <img src={logoSyncleticsWhite} alt="Syncletics" className="hidden h-7 w-auto dark:block" />
          </Link>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group mb-6 w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 text-left transition-colors hover:bg-sidebar-accent hover:border-primary/40"
            title="Show enrollment QR codes"
          >
            <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{club.sport}</p>
            <p className="mt-0.5 truncate font-semibold">{club.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <QrCode className="h-3 w-3" /> {t("common.teamCode")}
              </span>
              <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">{club.team_code}</span>
            </div>
          </button>
          <NavList />
          {/* Account controls belong in the mobile drawer. On desktop the same
              actions are available from the top bar and account pages. */}
          <div className="mt-auto space-y-3 pt-4 lg:hidden">
            <LanguageMenu />
            <div className="flex items-center gap-2 rounded-lg px-2 py-2">
              <UserBubble size="h-8 w-8" fallbackClass="bg-primary/10 text-xs font-semibold text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{profile?.display_name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{membership.role.replace("_", " ")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> {t("common.signOut")}
            </Button>
          </div>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

        <main className="min-h-screen min-w-0 flex-1 overflow-x-hidden lg:ml-0">
          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur lg:flex xl:px-8">
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <LanguageMenu compact />
              <MessagesPopover />
              <AnnouncementsPopover />
              <NotificationsPopover />
              <Link to="/app/settings" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Link>
              <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <Link to="/app/profile" className="flex items-center gap-3 rounded-full border border-border py-1 pl-1 pr-4 transition hover:bg-muted">
              <UserBubble size="h-8 w-8" fallbackClass="bg-primary text-xs font-semibold text-primary-foreground" />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-bold uppercase tracking-wider">{profile?.display_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
              </div>
            </Link>
          </header>
          <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 lg:px-8 lg:py-10">{children}</div>
        </main>

      </div>
      {/* Mobile bottom navigation */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMoreOpen(false)} />
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {moreOpen && (
          <div className="absolute inset-x-0 bottom-full space-y-0.5 rounded-t-2xl border-t border-border bg-background p-2 shadow-lg">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <UserBubble size="h-9 w-9" fallbackClass="bg-primary/10 text-sm font-semibold text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profile?.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <Link
              to="/app/profile"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/app/profile" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <UserIcon className="h-4 w-4" /> {t("nav.profile")}
            </Link>
            <Link
              to="/app/settings"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/app/settings" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <Settings className="h-4 w-4" /> {t("nav.settings")}
            </Link>
            {moreTabs.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" /> {t(item.labelKey)}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => { setMoreOpen(false); signOut(); }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> {t("common.signOut")}
            </button>
          </div>
        )}
        <div className="grid grid-cols-5">
          {bottomTabs.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => { setMoreOpen(false); void hapticTick(); }}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => { setMoreOpen(!moreOpen); void hapticTick(); }}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              moreOpen || pathname === "/app/profile" || pathname === "/app/settings" || moreTabs.some((i) => pathname === i.to)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Account"
          >
            <UserBubble size="h-5 w-5" fallbackClass="bg-primary/10 text-[9px] font-semibold text-primary" />
            <span>Account</span>
          </button>
        </div>
      </nav>
      <EnrollQRDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        clubId={club.id}
        clubName={club.name}
        teamCode={club.team_code}
      />
    </div>
  );
}
