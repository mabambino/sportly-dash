import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { GripVertical, Trash2, Search, Sun, Moon, Monitor, Languages } from "lucide-react";
import { useState, useEffect, useMemo, type DragEvent } from "react";
import { describeFee, DEFAULT_FEE } from "@/lib/fees";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useI18n, LANGUAGES, type LangCode } from "@/lib/i18n";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Syncletics" }] }),
  component: SettingsPage,
});

// Every settings section is indexed with keywords so the search box can find
// anything on this page, regardless of which tab it lives in.
const TAB_INDEX: { value: string; label: string; keywords: string[] }[] = [
  { value: "club", label: "Club", keywords: ["club name", "sport", "description", "monthly fee", "price"] },
  { value: "team", label: "Team", keywords: ["roles", "permissions", "members", "trainer", "student", "parent", "remove member", "staff", "promote"] },
  { value: "billing", label: "Billing", keywords: ["payment", "platform fee", "stripe", "invoices", "checkout", "revenue"] },
  { value: "dashboard", label: "Dashboard", keywords: ["layout", "cards", "tiles", "order", "rearrange", "grid", "widgets", "drag"] },
  { value: "account", label: "Account", keywords: ["password", "display name", "email", "security", "credentials", "personal details", "profile"] },
  { value: "appearance", label: "Appearance", keywords: ["theme", "dark mode", "light mode", "dark", "light", "system", "colors", "display"] },
  { value: "language", label: "Language", keywords: ["translation", "locale", "english", "macedonian", "albanian", "german", "french", "spanish", "multilanguage"] },
];

// Dashboard cards the user can rearrange into a square-tile layout.
const DEFAULT_DASHBOARD_CARDS = [
  "Total Members",
  "Attendance Rate",
  "Upcoming Sessions",
  "Monthly Revenue",
];

const DASHBOARD_LAYOUTS = [
  { value: "grid-2", label: "2 across (square tiles)" },
  { value: "grid-3", label: "3 across" },
  { value: "grid-4", label: "4 across (row)" },
];

function readDashboardPrefs(prefs: unknown) {
  const value = (prefs ?? {}) as { order?: unknown; layout?: unknown };
  const order =
    Array.isArray(value.order) && value.order.length
      ? (value.order as string[])
      : DEFAULT_DASHBOARD_CARDS;
  const layout = typeof value.layout === "string" ? value.layout : "grid-4";
  return { order, layout };
}

function SettingsPage() {
  const { membership } = useAuth();
  const { t } = useI18n();
  const isOwner = membership?.role === "club_owner";
  const [activeTab, setActiveTab] = useState("club");
  const [query, setQuery] = useState("");

  // Search across all settings sections (tab labels + keywords).
  const visibleTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TAB_INDEX;
    return TAB_INDEX.filter(
      (tab) =>
        tab.label.toLowerCase().includes(q) ||
        tab.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  // If the active tab gets filtered out, jump to the first match.
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Manage your club, team and preferences.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.search")}
            className="pl-9"
            aria-label="Search settings"
          />
        </div>
      </div>

      {visibleTabs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("settings.noResults")}
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="club" className="mt-6">
            {isOwner ? <ClubSettings /> : <Card className="p-8 text-center text-sm text-muted-foreground">Only the club owner can edit club settings.</Card>}
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            {isOwner ? <TeamSettings /> : <Card className="p-8 text-center text-sm text-muted-foreground">Only the club owner can manage roles.</Card>}
          </TabsContent>

          <TabsContent value="billing" className="mt-6">
            <BillingSettings />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <DashboardSettings />
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <AppearanceSettings />
          </TabsContent>

          <TabsContent value="language" className="mt-6">
            <LanguageSettings />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ClubSettings() {
  const { club, refresh } = useAuth();
  const [name, setName] = useState(club?.name ?? "");
  const [sport, setSport] = useState(club?.sport ?? "");
  const [description, setDescription] = useState((club as any)?.description ?? "");
  const [fee, setFee] = useState(String((club?.monthly_fee_cents ?? 0) / 100));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (club) {
      setName(club.name);
      setSport(club.sport);
      setDescription((club as any).description ?? "");
      setFee(String((club.monthly_fee_cents ?? 0) / 100));
    }
  }, [club]);

  const save = async () => {
    if (!club) return;
    setBusy(true);
    const { error } = await supabase.from("clubs").update({
      name: name.trim(),
      sport: sport.trim(),
      description: description.trim() || null,
      monthly_fee_cents: Math.round(parseFloat(fee || "0") * 100),
    }).eq("id", club.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Club settings saved");
    await refresh();
  };

  return (
    <Card className="max-w-xl p-6">
      <div className="space-y-4">
        <div>
          <Label>Club name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Sport</Label>
          <Input value={sport} onChange={(e) => setSport(e.target.value)} />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What your club is about…" />
        </div>
        <div>
          <Label>Default monthly fee ($)</Label>
          <Input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Used for members who are not enrolled in a priced course.</p>
        </div>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </div>
    </Card>
  );
}

function TeamSettings() {
  const { club, user } = useAuth();
  const qc = useQueryClient();

  const { data: members } = useQuery({
    enabled: !!club,
    queryKey: ["team-settings", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id).order("joined_at");
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const changeRole = async (membershipId: string, role: "trainer" | "student" | "parent") => {
    const { error } = await supabase.from("memberships").update({ role }).eq("id", membershipId);
    if (error) { toast.error(error.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["team-settings"] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const removeMember = async (m: any) => {
    if (!confirm(`Remove ${m.profile?.display_name || "this member"} from the club?`)) return;
    const { error } = await supabase.from("memberships").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Member removed");
    qc.invalidateQueries({ queryKey: ["team-settings"] });
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border p-4">
        <h3 className="font-semibold">Roles &amp; permissions</h3>
        <p className="text-sm text-muted-foreground">Promote members to trainer, or change their role. Owners can't be changed here.</p>
      </div>
      <div className="divide-y divide-border">
        {(members || []).map((m: any) => {
          const isSelf = m.user_id === user?.id;
          const isOwnerRow = m.role === "club_owner";
          return (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                  {m.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.profile?.display_name || "Unknown"}{isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwnerRow ? (
                  <Badge>Owner</Badge>
                ) : (
                  <>
                    <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as any)}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trainer">Trainer</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" onClick={() => removeMember(m)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {(members || []).length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No members yet.</p>}
      </div>
    </Card>
  );
}

function BillingSettings() {
  const { club } = useAuth();
  const feeConfig = {
    feePercentBps: (club as any)?.fee_percent_bps ?? DEFAULT_FEE.feePercentBps,
    feeFixedCents: (club as any)?.fee_fixed_cents ?? DEFAULT_FEE.feeFixedCents,
  };
  return (
    <div className="max-w-xl space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold">Platform fee</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Syncletics charges <span className="font-medium text-foreground">{describeFee(feeConfig)}</span> per member payment. The fee is deducted from each collected amount — see the Revenue page for a live breakdown, including tax.
        </p>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold">Payment provider</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Member payments currently use a simulated checkout validated server-side. Card details are never entered or stored in Syncletics — when Stripe is connected, members will pay on Stripe's hosted checkout page.
        </p>
      </Card>
      <Separator />
      <p className="text-xs text-muted-foreground">Looking for invoices? They live in the Billing page; club-level totals are on the Revenue page.</p>
    </div>
  );
}

function AccountSettings() {
  const { profile, user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  const saveDetails = async () => {
    if (!user?.id) return;
    setSavingDetails(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setSavingDetails(false);
    if (error) { toast.error(error.message); return; }
    await refresh();
    toast.success("Details saved");
  };

  const changePassword = async () => {
    if (pw1.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (pw1 !== pw2) { toast.error("Passwords don't match"); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) { toast.error(error.message); return; }
    setPw1(""); setPw2("");
    toast.success("Password updated");
  };

  return (
    <div className="max-w-xl space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold">Personal details</h3>
        <p className="mb-4 text-sm text-muted-foreground">This is how your name appears across the app.</p>
        <div className="space-y-4">
          <div>
            <Label>Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={profile?.email || user?.email || ""} disabled />
          </div>
          <Button onClick={saveDetails} disabled={savingDetails}>
            {savingDetails ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold">Change password</h3>
        <p className="mb-4 text-sm text-muted-foreground">Must be at least 6 characters.</p>
        <div className="space-y-4">
          <div>
            <Label>New password</Label>
            <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
          </div>
          <Button onClick={changePassword} disabled={savingPw}>
            {savingPw ? "Updating…" : "Update password"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];
  return (
    <Card className="max-w-xl p-6">
      <h3 className="font-semibold">{t("common.theme")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">Choose how Syncletics looks to you. Light is the default.</p>
      <div className="flex flex-wrap gap-3">
        {THEMES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            className={`flex w-32 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
              theme === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <opt.icon className="h-5 w-5" />
            {opt.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function LanguageSettings() {
  const { lang, setLang, t } = useI18n();
  return (
    <Card className="max-w-xl p-6">
      <h3 className="font-semibold">
        <Languages className="mr-2 inline h-4 w-4" />
        {t("common.language")}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">Applies immediately and is remembered on this device.</p>
      <div className="flex flex-wrap gap-3">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code as LangCode)}
            className={`flex w-36 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
              lang === l.code
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <span>{l.flag}</span> {l.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function DashboardSettings() {
  const { profile, user, refresh } = useAuth();
  const initialDashPrefs = readDashboardPrefs(profile?.dashboard_prefs);
  const [dashOrder, setDashOrder] = useState<string[]>(initialDashPrefs.order);
  const [dashLayout, setDashLayout] = useState(initialDashPrefs.layout);
  const [dashSaved, setDashSaved] = useState(false);
  const [dashSaving, setDashSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Keep local editing state in sync once the profile (and its saved prefs) loads.
  useEffect(() => {
    const prefs = readDashboardPrefs(profile?.dashboard_prefs);
    setDashOrder(prefs.order);
    setDashLayout(prefs.layout);
    setDashSaved(false);
  }, [profile?.dashboard_prefs]);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    setDashSaved(false);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    setDashOrder((prev) => {
      if (dragIndex === null || dragIndex === index) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
    setDashSaved(false);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const saveDashboardLayout = async () => {
    if (!user?.id) return;
    setDashSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ dashboard_prefs: { order: dashOrder, layout: dashLayout } } as any)
      .eq("id", user.id);
    setDashSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDashSaved(true);
    await refresh();
    toast.success("Dashboard layout saved");
  };

  const resetDashboardLayout = () => {
    setDashOrder(DEFAULT_DASHBOARD_CARDS);
    setDashLayout("grid-4");
    setDashSaved(false);
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-semibold">Dashboard Layout</h2>
        <p className="text-sm text-muted-foreground">
          Drag the cards to rearrange your dashboard tiles, then choose the
          layout that works best for you.
        </p>
      </section>

      <Separator />

      <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h3 className="font-semibold">Layout</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose how many cards appear per row.
          </p>
          <RadioGroup
            value={dashLayout}
            onValueChange={(value) => {
              setDashLayout(value);
              setDashSaved(false);
            }}
            className="space-y-2"
          >
            {DASHBOARD_LAYOUTS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`layout-${opt.value}`} />
                <Label htmlFor={`layout-${opt.value}`}>{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <h3 className="font-semibold">Card Order</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Drag and drop to rearrange your dashboard tiles.
          </p>
          <div className="space-y-2">
            {dashOrder.map((card, index) => (
              <div
                key={card}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex cursor-grab items-center justify-between rounded-lg border bg-background px-4 py-3 transition-colors active:cursor-grabbing ${
                  dragOverIndex === index && dragIndex !== index
                    ? "border-primary bg-accent"
                    : "border-border"
                } ${dragIndex === index ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{card}</span>
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  {index + 1}
                </Badge>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={saveDashboardLayout} disabled={dashSaving}>
              {dashSaving ? "Saving…" : "Save layout"}
            </Button>
            <Button variant="outline" onClick={resetDashboardLayout} disabled={dashSaving}>
              Reset to default
            </Button>
            {dashSaved ? (
              <Badge className="border-emerald-500/40 text-emerald-500">
                Saved
              </Badge>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
