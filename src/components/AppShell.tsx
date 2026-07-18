import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
  Sun, Moon, Languages, Menu, RefreshCw, X,
} from "lucide-react";
import logoSyncletics from "@/assets/logo-syncletics.svg";
import logoSyncleticsWhite from "@/assets/logo-syncletics-white.svg";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EnrollQRDialog } from "@/components/EnrollQRDialog";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MessagesPopover, AnnouncementsPopover, NotificationsPopover, AlertsPopover } from "@/components/HeaderQuickViews";
import { useAvatar } from "@/lib/user-settings";
import { hapticTick } from "@/lib/native";
import { ShakeFeedback } from "@/components/ShakeFeedback";


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


/**
 * App-style pull-to-refresh: dragging down from the top of the page refetches
 * data (react-query caches + route loaders) instead of reloading the webview.
 * Touch-only; ignores pulls that start inside dialogs or nested scrollers.
 */
const PTR_THRESHOLD = 72;

function PullToRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    const setPullBoth = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || window.scrollY > 0) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], [data-radix-scroll-area-viewport], textarea, [data-no-ptr]')) return;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || busyRef.current) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0 || window.scrollY > 0) { setPullBoth(0); return; }
      // Resistance curve so the indicator trails the finger like UIKit.
      if (e.cancelable) e.preventDefault();
      const next = Math.min(delta * 0.45, PTR_THRESHOLD * 1.6);
      if (pullRef.current < PTR_THRESHOLD && next >= PTR_THRESHOLD) void hapticTick();
      setPullBoth(next);
    };

    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= PTR_THRESHOLD && !busyRef.current) {
        busyRef.current = true;
        setRefreshing(true);
        setPullBoth(PTR_THRESHOLD * 0.85);
        void Promise.allSettled([
          queryClient.invalidateQueries(),
          router.invalidate(),
        ]).then(() => {
          setTimeout(() => {
            setRefreshing(false);
            setPullBoth(0);
            busyRef.current = false;
          }, 350);
        });
      } else {
        setPullBoth(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router, queryClient]);

  const visible = pull > 4 || refreshing;
  const progress = Math.min(pull / PTR_THRESHOLD, 1);

  return (
    <div
      aria-hidden={!refreshing}
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-[60] flex justify-center lg:hidden"
      style={{ transform: `translateY(${visible ? pull * 0.6 + 8 : -160}px)`, opacity: visible ? 1 : 0, transition: startY.current === null ? "transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease" : "none" }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card shadow-card">
        <RefreshCw
          className={cn("h-4 w-4 text-muted-foreground", refreshing && "animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)`, opacity: 0.35 + progress * 0.65 }}
        />
      </div>
    </div>
  );
}

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
                    "flex items-center gap-3 rounded-full px-4 py-2.5 text-base font-medium transition-colors lg:px-3 lg:py-1.5 lg:text-sm",
                    active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                    // Announcements live in the header bell on mobile.
                    item.to === "/app/announcements" && "hidden lg:flex"
                  )}
                >
                  <item.icon className="h-5 w-5 lg:h-4 lg:w-4" /> {t(item.labelKey)}
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
      <PullToRefresh />
      <ShakeFeedback />
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition hover:bg-muted">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold tracking-tight">{pageTitle}</h1>
        <div className="flex shrink-0 items-center gap-2">
          <AlertsPopover />
          <Link to="/app/profile" aria-label="Profile" className="shrink-0">
            <UserBubble size="h-10 w-10" fallbackClass="bg-secondary text-sm font-semibold text-foreground" />
          </Link>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-0 z-50 flex w-full flex-col overflow-y-auto bg-sidebar p-6 pt-[calc(1.25rem+env(safe-area-inset-top))] transition-transform lg:static lg:inset-auto lg:w-64 lg:border-r lg:border-sidebar-border lg:p-4 lg:pt-4 lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <Link to="/app/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 lg:px-2">
              <img src={logoSyncletics} alt="Syncletics" className="h-7 w-auto dark:hidden" />
              <img src={logoSyncleticsWhite} alt="Syncletics" className="hidden h-7 w-auto dark:block" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="group mb-6 w-full rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-3 text-left transition-colors hover:bg-sidebar-accent hover:border-primary/40"
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
          <div className="mx-auto max-w-7xl px-4 pb-32 pt-6 lg:px-8 lg:py-10">{children}</div>
        </main>

      </div>
      {/* Mobile bottom navigation */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMoreOpen(false)} />
      )}
      <nav data-hide-on-keyboard className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 rounded-full border border-border bg-card/95 px-1.5 shadow-elegant backdrop-blur-lg lg:hidden">
        {moreOpen && (
          <div className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] space-y-0.5 rounded-3xl border border-border bg-card p-2 shadow-elegant">
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
                "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === "/app/profile" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <UserIcon className="h-4 w-4" /> {t("nav.profile")}
            </Link>
            <Link
              to="/app/settings"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors",
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
                    "flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-5 w-5 lg:h-4 lg:w-4" /> {t(item.labelKey)}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => { setMoreOpen(false); signOut(); }}
              className="flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> {t("common.signOut")}
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 px-1.5">
          {bottomTabs.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => { setMoreOpen(false); void hapticTick(); }}
                className={cn(
                  "my-1.5 flex min-w-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all",
                  active
                    ? "flex-[1.8] bg-foreground px-3 py-2.5 text-background shadow-sm"
                    : "h-11 flex-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-label={t(item.labelKey)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {active && <span className="min-w-0 truncate">{t(item.labelKey)}</span>}
              </Link>
            );
          })}
          {(() => {
            const accountActive = moreOpen || pathname === "/app/profile" || pathname === "/app/settings" || moreTabs.some((i) => pathname === i.to);
            return (
              <button
                type="button"
                onClick={() => { setMoreOpen(!moreOpen); void hapticTick(); }}
                className={cn(
                  "my-1.5 flex min-w-0 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-all",
                  accountActive
                    ? "flex-[1.8] bg-foreground px-3 py-2 text-background shadow-sm"
                    : "h-11 flex-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
                aria-label="Account"
              >
                <UserBubble size="h-6 w-6" fallbackClass={cn("text-[10px] font-semibold", accountActive ? "bg-background/25 text-background" : "bg-primary/10 text-primary")} />
                {accountActive && <span className="min-w-0 truncate">Account</span>}
              </button>
            );
          })()}
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
