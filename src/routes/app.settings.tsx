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
import { Plus, MoreVertical, CreditCard, GripVertical, Copy, Check } from "lucide-react";
import { useState, useEffect, type DragEvent } from "react";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Syncletics" }] }),
  component: SettingsPage,
});

const TABS = [
  "My details",
  "Profile",
  "Password",
  "Team",
  "Billings",
  "Plan",
  "Email",
  "Notifications",
  "Dashboard",
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

const NOTIFICATION_OPTIONS = [
  {
    id: "schedule",
    label: "Schedule updates",
    description: "When sessions are added, moved or cancelled.",
    default: true,
  },
  {
    id: "attendance",
    label: "Attendance reminders",
    description: "Reminders to mark attendance after a session.",
    default: true,
  },
  {
    id: "billing",
    label: "Billing & payments",
    description: "Invoices, receipts and failed payments.",
    default: true,
  },
  {
    id: "digest",
    label: "Weekly digest",
    description: "A weekly summary of team activity.",
    default: false,
  },
] as const;

function readNotifPrefs(
  prefs: { notifications?: Record<string, boolean> } | null | undefined,
): Record<string, boolean> {
  const saved = (prefs as { notifications?: Record<string, boolean> } | null)
    ?.notifications;
  const result: Record<string, boolean> = {};
  for (const opt of NOTIFICATION_OPTIONS) {
    result[opt.id] = saved?.[opt.id] ?? opt.default;
  }
  return result;
}

function SettingsPage() {
  const { profile, user, club, refresh } = useAuth();
  const [emailChoice, setEmailChoice] = useState("existing");
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

  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [isParent, setIsParent] = useState(profile?.is_parent ?? false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    readNotifPrefs(profile?.dashboard_prefs),
  );
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setIsParent(profile?.is_parent ?? false);
    setNotifPrefs(readNotifPrefs(profile?.dashboard_prefs));
  }, [profile]);

  const saveDetails = async () => {
    if (!user?.id) return;
    setDetailsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setDetailsSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDetailsSaved(true);
    await refresh();
    toast.success("Details saved");
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setProfileSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl || null, is_parent: isParent })
      .eq("id", user.id);
    setProfileSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setProfileSaved(true);
    await refresh();
    toast.success("Profile saved");
  };

  const savePassword = async () => {
    if (!newPassword) {
      toast.error("Enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Password updated");
  };

  const saveEmail = async () => {
    if (!newEmail) {
      toast.error("Enter a new email");
      return;
    }
    setEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your inbox to confirm the new email");
    setNewEmail("");
    setEmailChoice("existing");
  };

  const copyTeamCode = async () => {
    if (!club?.team_code) return;
    await navigator.clipboard.writeText(club.team_code);
    setCodeCopied(true);
    toast.success("Team code copied");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const saveNotifications = async () => {
    if (!user?.id) return;
    setNotifSaving(true);
    const existing = (profile?.dashboard_prefs ?? {}) as Record<string, unknown>;
    const { error } = await supabase
      .from("profiles")
      .update({
        dashboard_prefs: { ...existing, notifications: notifPrefs },
      } as never)
      .eq("id", user.id);
    setNotifSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNotifSaved(true);
    await refresh();
    toast.success("Notification preferences saved");
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Tabs defaultValue="Billings" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

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

        {/* My details */}
        <TabsContent value="My details" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">My details</h2>
            <p className="text-sm text-muted-foreground">
              Update your personal information.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Personal info</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                This information is shown across your team workspace.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label htmlFor="account-email">Email</Label>
                <Input id="account-email" value={profile?.email ?? ""} disabled />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Button onClick={saveDetails} disabled={detailsSaving}>
                  {detailsSaving ? "Saving…" : "Save changes"}
                </Button>
                {detailsSaved ? (
                  <Badge className="border-emerald-500/40 text-emerald-500">
                    Saved
                  </Badge>
                ) : null}
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="Profile" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground">
              Customise how you appear to your team.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Avatar</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Paste a link to an image to use as your profile picture.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold uppercase">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
                  ) : (
                    (profile?.display_name ?? "?").slice(0, 1)
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="avatar-url">Avatar URL</Label>
                  <Input
                    id="avatar-url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-parent"
                  checked={isParent}
                  onCheckedChange={(v) => setIsParent(v === true)}
                />
                <Label htmlFor="is-parent" className="font-normal">
                  I am a parent / guardian account
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={saveProfile} disabled={profileSaving}>
                  {profileSaving ? "Saving…" : "Save profile"}
                </Button>
                {profileSaved ? (
                  <Badge className="border-emerald-500/40 text-emerald-500">
                    Saved
                  </Badge>
                ) : null}
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Password */}
        <TabsContent value="Password" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Password</h2>
            <p className="text-sm text-muted-foreground">
              Choose a new password for your account.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Change password</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Use at least 8 characters. You will stay signed in on this device.
              </p>
            </div>
            <div className="grid gap-4 sm:max-w-md">
              <div>
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
              <div>
                <Button onClick={savePassword} disabled={passwordSaving}>
                  {passwordSaving ? "Updating…" : "Update password"}
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Team */}
        <TabsContent value="Team" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Team</h2>
            <p className="text-sm text-muted-foreground">
              Your team workspace details and join code.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Workspace</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Share the team code so others can join your workspace.
              </p>
            </div>
            <div className="grid gap-4 sm:max-w-md">
              <div>
                <Label>Team name</Label>
                <Input value={club?.name ?? ""} disabled />
              </div>
              <div>
                <Label>Sport</Label>
                <Input value={club?.sport ?? ""} disabled className="capitalize" />
              </div>
              <div>
                <Label htmlFor="team-code">Team code</Label>
                <div className="flex items-center gap-2">
                  <Input id="team-code" value={club?.team_code ?? ""} readOnly className="font-mono uppercase" />
                  <Button variant="outline" onClick={copyTeamCode} disabled={!club?.team_code}>
                    {codeCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Plan */}
        <TabsContent value="Plan" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Plan</h2>
            <p className="text-sm text-muted-foreground">
              View your current subscription plan.
            </p>
          </section>

          <Separator />

          <section className="grid gap-4 sm:grid-cols-2">
            <Card className={`p-6 ${club?.plan === "free" ? "border-primary" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Free</h3>
                {club?.plan === "free" ? (
                  <Badge className="border-primary/40 text-primary">Current</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-bold">
                $0<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Core tools to manage a single team.
              </p>
            </Card>
            <Card className={`p-6 ${club?.plan === "pro" ? "border-primary" : ""}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Pro</h3>
                {club?.plan === "pro" ? (
                  <Badge className="border-primary/40 text-primary">Current</Badge>
                ) : null}
              </div>
              <p className="mt-2 text-2xl font-bold">
                ${((club?.monthly_fee_cents ?? 0) / 100).toFixed(0)}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Advanced billing, unlimited members and priority support.
              </p>
            </Card>
          </section>
        </TabsContent>

        {/* Email */}
        <TabsContent value="Email" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Email</h2>
            <p className="text-sm text-muted-foreground">
              Manage the email address linked to your account.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Contact email</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Keep your current email or switch to a new one.
              </p>
            </div>
            <div className="grid gap-4 sm:max-w-md">
              <RadioGroup value={emailChoice} onValueChange={setEmailChoice}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="existing" id="email-existing" />
                  <Label htmlFor="email-existing" className="font-normal">
                    Keep current ({profile?.email ?? "—"})
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="new" id="email-new" />
                  <Label htmlFor="email-new" className="font-normal">
                    Use a new email
                  </Label>
                </div>
              </RadioGroup>
              {emailChoice === "new" ? (
                <div>
                  <Label htmlFor="new-email">New email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </div>
              ) : null}
              <div>
                <Button
                  onClick={saveEmail}
                  disabled={emailSaving || emailChoice === "existing"}
                >
                  {emailSaving ? "Saving…" : "Update email"}
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="Notifications" className="mt-6 space-y-8">
          <section>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-sm text-muted-foreground">
              Choose what you want to be notified about.
            </p>
          </section>

          <Separator />

          <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <div>
              <h3 className="font-semibold">Email notifications</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                We will only email you about the things you turn on here.
              </p>
            </div>
            <div className="grid gap-4 sm:max-w-md">
              {NOTIFICATION_OPTIONS.map((opt) => (
                <div key={opt.id} className="flex items-start gap-3">
                  <Checkbox
                    id={`notif-${opt.id}`}
                    checked={notifPrefs[opt.id] ?? opt.default}
                    onCheckedChange={(v) =>
                      setNotifPrefs((prev) => ({ ...prev, [opt.id]: v === true }))
                    }
                  />
                  <div>
                    <Label htmlFor={`notif-${opt.id}`} className="font-normal">
                      {opt.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{opt.description}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button onClick={saveNotifications} disabled={notifSaving}>
                  {notifSaving ? "Saving…" : "Save preferences"}
                </Button>
                {notifSaved ? (
                  <Badge className="border-emerald-500/40 text-emerald-500">
                    Saved
                  </Badge>
                ) : null}
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
