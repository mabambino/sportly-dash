import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme, type Theme } from "@/lib/theme-context";
import { useI18n, LANGUAGES, type LangCode } from "@/lib/i18n";
import { Plus, MoreVertical, CreditCard, GripVertical, Search, Sun, Moon, Monitor, Languages } from "lucide-react";
import { useState, useEffect, useMemo, type DragEvent } from "react";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Syncletics" }] }),
  component: SettingsPage,
});

// Every settings "directory" is indexed here with keywords so the search box
// can find anything on this page, regardless of which tab it lives in.
const TABS: { name: string; keywords: string[] }[] = [
  { name: "My details", keywords: ["account", "name", "personal", "details", "user"] },
  { name: "Profile", keywords: ["avatar", "photo", "display name", "bio", "profile"] },
  { name: "Password", keywords: ["security", "change password", "credentials", "login", "reset"] },
  { name: "Team", keywords: ["club", "members", "team code", "roles", "staff", "trainer"] },
  { name: "Billings", keywords: ["payment", "card", "invoice", "billing history", "credit card", "contact email", "transactions"] },
  { name: "Plan", keywords: ["subscription", "upgrade", "pro", "free", "pricing", "plan"] },
  { name: "Email", keywords: ["inbox", "address", "notifications email", "contact"] },
  { name: "Notifications", keywords: ["alerts", "push", "reminders", "announcements"] },
  { name: "Appearance", keywords: ["theme", "dark mode", "light mode", "dark", "light", "system", "colors", "display"] },
  { name: "Language", keywords: ["translation", "locale", "english", "macedonian", "albanian", "german", "french", "spanish", "multilanguage"] },
  { name: "Dashboard", keywords: ["layout", "cards", "tiles", "rearrange", "order", "widgets", "grid"] },
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
  const layout = typeof value.layout === "string" ? value.layout : "grid-2";
  return { order, layout };
}

const HISTORY = [
  {
    invoice: "Account Sale",
    date: "Apr 14, 2004",
    amount: "$3,050",
    status: "Pending",
    tracking: "LM580405575CN",
    address: "313 Main Road, Sunderland",
  },
  {
    invoice: "Account Sale",
    date: "Jun 24, 2008",
    amount: "$1,050",
    status: "Cancelled",
    tracking: "AZ938540353US",
    address: "96 Grange Road, Peterborough",
  },
  {
    invoice: "Netflix Subscription",
    date: "Feb 28, 2004",
    amount: "$800",
    status: "Refund",
    tracking: "3S331605504US",
    address: "2 New Street, Harrogate",
  },
];

const STATUS_STYLES: Record<string, string> = {
  Pending: "border-emerald-500/40 text-emerald-500",
  Cancelled: "border-red-500/40 text-red-500",
  Refund: "border-emerald-500/40 text-emerald-500",
};

function SettingsPage() {
  const { profile, user, refresh } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [emailChoice, setEmailChoice] = useState("existing");
  const [activeTab, setActiveTab] = useState("My details");
  const [query, setQuery] = useState("");

  // Search across all settings directories (tab names + keywords).
  const visibleTabs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TABS;
    return TABS.filter(
      (tab) =>
        tab.name.toLowerCase().includes(q) ||
        tab.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  // If the active tab gets filtered out, jump to the first match.
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some((tab) => tab.name === activeTab)) {
      setActiveTab(visibleTabs[0].name);
    }
  }, [visibleTabs, activeTab]);

  // My details
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [savingDetails, setSavingDetails] = useState(false);
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

  // Password
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

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

  // Dashboard layout
  const initialDashPrefs = readDashboardPrefs(profile?.dashboard_prefs);
  const [dashOrder, setDashOrder] = useState<string[]>(initialDashPrefs.order);
  const [dashLayout, setDashLayout] = useState(initialDashPrefs.layout);
  const [dashSaved, setDashSaved] = useState(false);
  const [dashSaving, setDashSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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
      .update({ dashboard_prefs: { order: dashOrder, layout: dashLayout } })
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
    setDashLayout("grid-2");
    setDashSaved(false);
  };

  const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: t("theme.light"), icon: Sun },
    { value: "dark", label: t("theme.dark"), icon: Moon },
    { value: "system", label: t("theme.system"), icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t("settings.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
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
            {visibleTabs.map(({ name }) => (
              <TabsTrigger
                key={name}
                value={name}
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                {name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="My details" className="mt-6 space-y-8">
            <section>
              <h2 className="font-semibold">My details</h2>
              <p className="text-sm text-muted-foreground">Update your personal information.</p>
            </section>
            <Separator />
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">Personal info</h3>
                <p className="text-sm text-muted-foreground">This is how your name appears across the app.</p>
              </div>
              <div className="max-w-sm space-y-4">
                <div>
                  <Label>Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={profile?.email || user?.email || ""} disabled />
                  <p className="mt-1 text-xs text-muted-foreground">Email changes are managed from the Email tab.</p>
                </div>
                <Button onClick={saveDetails} disabled={savingDetails}>
                  {savingDetails ? "Saving…" : t("common.save")}
                </Button>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="Password" className="mt-6 space-y-8">
            <section>
              <h2 className="font-semibold">Password</h2>
              <p className="text-sm text-muted-foreground">Change the password you use to log in.</p>
            </section>
            <Separator />
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">Change password</h3>
                <p className="text-sm text-muted-foreground">Must be at least 6 characters.</p>
              </div>
              <div className="max-w-sm space-y-4">
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
            </section>
          </TabsContent>

          <TabsContent value="Appearance" className="mt-6 space-y-8">
            <section>
              <h2 className="font-semibold">{t("common.theme")}</h2>
              <p className="text-sm text-muted-foreground">Choose how Syncletics looks to you.</p>
            </section>
            <Separator />
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">Interface theme</h3>
                <p className="text-sm text-muted-foreground">Select light, dark, or follow your system.</p>
              </div>
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
            </section>
          </TabsContent>

          <TabsContent value="Language" className="mt-6 space-y-8">
            <section>
              <h2 className="font-semibold">{t("common.language")}</h2>
              <p className="text-sm text-muted-foreground">Choose the language used across the app.</p>
            </section>
            <Separator />
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">
                  <Languages className="mr-2 inline h-4 w-4" />
                  App language
                </h3>
                <p className="text-sm text-muted-foreground">Applies immediately and is remembered on this device.</p>
              </div>
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
            </section>
          </TabsContent>

          <TabsContent value="Billings" className="mt-6 space-y-8">
            {/* Payment Method */}
            <section>
              <h2 className="font-semibold">Payment Method</h2>
              <p className="text-sm text-muted-foreground">
                Update your billing details and address.
              </p>
            </section>

            <Separator />

            {/* Card Details */}
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">Card Details</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Update your billing details and address.
                </p>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Add another card
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Name on your Card</Label>
                  <Input placeholder="Full name on card" />
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Input placeholder="MM / YY" />
                </div>
                <div>
                  <Label>Card Number</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Card number"
                    />
                  </div>
                </div>
                <div>
                  <Label>CVV</Label>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="•••"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Contact email */}
            <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div>
                <h3 className="font-semibold">Contact email</h3>
                <p className="text-sm text-muted-foreground">
                  Where should invoices be sent?
                </p>
              </div>
              <RadioGroup value={emailChoice} onValueChange={setEmailChoice} className="space-y-3">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="existing" id="email-existing" className="mt-1" />
                  <Label htmlFor="email-existing" className="font-normal">
                    <span className="block font-medium">Send to the existing email</span>
                    <span className="text-sm text-muted-foreground">
                      {profile?.email || user?.email || "your@email.com"}
                    </span>
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="another" id="email-another" />
                  <Label htmlFor="email-another" className="font-normal">
                    Add another email address
                  </Label>
                </div>
                {emailChoice === "another" && (
                  <Input placeholder="new@email.com" className="max-w-sm" />
                )}
              </RadioGroup>
            </section>

            <Separator />

            {/* Billing History */}
            <section>
              <h3 className="font-semibold">Billing History</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                See the transaction you made
              </p>
              <Card className="overflow-hidden p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tracking &amp; Address</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {HISTORY.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Checkbox />
                        </TableCell>
                        <TableCell className="font-medium">{h.invoice}</TableCell>
                        <TableCell className="text-muted-foreground">{h.date}</TableCell>
                        <TableCell>{h.amount}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[h.status]}>
                            {h.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-primary">{h.tracking}</p>
                          <p className="text-xs text-muted-foreground">{h.address}</p>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </section>
          </TabsContent>

          <TabsContent value="Dashboard" className="mt-6 space-y-8">
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
          </TabsContent>

          {["Profile", "Team", "Plan", "Email", "Notifications"].map((name) => (
            <TabsContent key={name} value={name} className="mt-6">
              <Card className="p-8 text-center text-sm text-muted-foreground">
                {name} settings coming soon.
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
