import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SensitiveValue } from "@/components/SensitiveValue";
import { DollarSign, TrendingUp, AlertCircle, Landmark } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { describeFee, computeFeeCents, DEFAULT_FEE } from "@/lib/fees";

export const Route = createFileRoute("/app/revenue")({
  head: () => ({ meta: [{ title: "Revenue — Syncletics" }] }),
  component: RevenuePage,
});

// Common VAT rates. Tax is treated as included in the price
// (VAT-style): tax = gross × r / (100 + r).
const TAX_PRESETS = [
  { code: "none", label: "No tax", rate: 0 },
  { code: "mk", label: "North Macedonia (18%)", rate: 18 },
  { code: "de", label: "Germany (19%)", rate: 19 },
  { code: "fr", label: "France (20%)", rate: 20 },
  { code: "uk", label: "United Kingdom (20%)", rate: 20 },
  { code: "nl", label: "Netherlands (21%)", rate: 21 },
  { code: "es", label: "Spain (21%)", rate: 21 },
  { code: "it", label: "Italy (22%)", rate: 22 },
  { code: "custom", label: "Custom rate…", rate: 0 },
];

function useTaxSettings(clubId: string | undefined) {
  const key = clubId ? `syncletics-tax-${clubId}` : null;
  const [country, setCountry] = useState("none");
  const [rate, setRate] = useState(0);

  useEffect(() => {
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved) {
        setCountry(saved.country ?? "none");
        setRate(Number(saved.rate) || 0);
      }
    } catch {
      /* ignore */
    }
  }, [key]);

  const update = (nextCountry: string, nextRate: number) => {
    setCountry(nextCountry);
    setRate(nextRate);
    if (key) localStorage.setItem(key, JSON.stringify({ country: nextCountry, rate: nextRate }));
  };

  return { country, rate, update };
}

/** Tax portion of a tax-inclusive gross amount, in cents. */
const taxOfGross = (grossCents: number, ratePct: number) =>
  ratePct > 0 ? Math.round((grossCents * ratePct) / (100 + ratePct)) : 0;

function StatCard({ label, value, icon: Icon, sub, sensitive }: { label: string; value: string; icon: any; sub?: string; sensitive?: boolean }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {sensitive ? <SensitiveValue mask="$ ••••">{value}</SensitiveValue> : value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

function RevenuePage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const { country, rate, update } = useTaxSettings(club?.id);

  const { data, isLoading } = useQuery({
    enabled: !!club,
    queryKey: ["revenue", club?.id],
    queryFn: async () => {
      const [payments, mems, groups] = await Promise.all([
        supabase.from("payments").select("*").eq("club_id", club!.id).order("period_month", { ascending: false }),
        supabase.from("memberships").select("*").eq("club_id", club!.id).neq("role", "club_owner"),
        supabase.from("course_groups").select("*").eq("club_id", club!.id),
      ]);
      const memberIds = Array.from(new Set([
        ...(payments.data || []).map((p) => p.member_id),
        ...(mems.data || []).map((m) => m.user_id),
      ]));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
      return {
        payments: payments.data || [],
        memberships: mems.data || [],
        groups: groups.data || [],
        profiles: profs || [],
      };
    },
  });

  const payments = data?.payments || [];
  const memberships = data?.memberships || [];
  const groups = data?.groups || [];
  const profiles = data?.profiles || [];
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.display_name ?? "Unknown";
  const groupOfMember = (memberId: string) => {
    const m = memberships.find((x) => x.user_id === memberId);
    return m?.group_id ? groups.find((g: any) => g.id === m.group_id) : undefined;
  };

  const feeConfig = {
    feePercentBps: (club as any)?.fee_percent_bps ?? DEFAULT_FEE.feePercentBps,
    feeFixedCents: (club as any)?.fee_fixed_cents ?? DEFAULT_FEE.feeFixedCents,
  };

  const now = new Date();
  const thisMonthKey = format(startOfMonth(now), "yyyy-MM");
  const lastMonthKey = format(startOfMonth(subMonths(now, 1)), "yyyy-MM");
  const periodKey = (p: any) => String(p.period_month).slice(0, 7);

  const paid = payments.filter((p) => p.status === "paid");
  const paidThisMonth = paid.filter((p) => periodKey(p) === thisMonthKey);
  const paidLastMonth = paid.filter((p) => periodKey(p) === lastMonthKey);
  const outstanding = payments.filter((p) => p.status !== "paid");

  const grossThisMonth = paidThisMonth.reduce((s, p) => s + p.amount_cents, 0);
  const grossLastMonth = paidLastMonth.reduce((s, p) => s + p.amount_cents, 0);
  const outstandingTotal = outstanding.reduce((s, p) => s + p.amount_cents, 0);

  // MRR estimate: course price for grouped members, club fee for other students.
  const mrr = memberships.reduce((s, m) => {
    const g = m.group_id ? groups.find((x: any) => x.id === m.group_id) : null;
    if (g) return s + (g.price_cents || 0);
    return m.role === "student" ? s + (club?.monthly_fee_cents || 0) : s;
  }, 0);

  // Tax + platform fee breakdown for this month's collected revenue.
  const taxThisMonth = taxOfGross(grossThisMonth, rate);
  const feesThisMonth = paidThisMonth.reduce((s, p) => s + computeFeeCents(p.amount_cents, feeConfig), 0);
  const netThisMonth = grossThisMonth - taxThisMonth - feesThisMonth;

  // Collected per month, last 6 months (by invoice period).
  const monthly = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = startOfMonth(subMonths(new Date(), 5 - i));
      const key = format(d, "yyyy-MM");
      const total = payments.filter((p) => p.status === "paid" && String(p.period_month).slice(0, 7) === key).reduce((s, p) => s + p.amount_cents, 0);
      return { month: format(d, "MMM"), collected: total / 100 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  const revenueByGroup = groups.map((g: any) => {
    const memberIdsInGroup = new Set(memberships.filter((m) => m.group_id === g.id).map((m) => m.user_id));
    const total = paid.filter((p) => memberIdsInGroup.has(p.member_id)).reduce((s, p) => s + p.amount_cents, 0);
    return { ...g, total, memberCount: memberIdsInGroup.size };
  });

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Marked as paid"); qc.invalidateQueries({ queryKey: ["revenue"] }); }
  };

  const onCountryChange = (code: string) => {
    const preset = TAX_PRESETS.find((t) => t.code === code)!;
    update(code, code === "custom" ? rate : preset.rate);
  };

  if (!isStaff) return <Card className="p-8 text-center text-sm text-muted-foreground">Access restricted to staff.</Card>;
  if (isLoading) return <Card className="p-8 text-center text-sm text-muted-foreground">Loading revenue…</Card>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Revenue</h1>
        <p className="text-sm text-muted-foreground">Financial overview for {club?.name} · platform fee {describeFee(feeConfig)} per payment</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR (est.)" value={`$${(mrr / 100).toFixed(0)}`} icon={TrendingUp} sub="From course prices and club fee" sensitive />
        <StatCard label="Collected this month" value={`$${(grossThisMonth / 100).toFixed(0)}`} icon={DollarSign} sub={`vs $${(grossLastMonth / 100).toFixed(0)} last month`} sensitive />
        <StatCard label="Outstanding" value={`$${(outstandingTotal / 100).toFixed(0)}`} icon={AlertCircle} sub={`${outstanding.length} unpaid invoices`} />
        <StatCard label="Net this month" value={`$${(netThisMonth / 100).toFixed(0)}`} icon={Landmark} sub="After tax and platform fees" sensitive />
      </div>

      {/* Tax settings + breakdown */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Tax</h2>
            <p className="text-sm text-muted-foreground">
              Pick your country (or a custom rate) and the tax share of collected revenue is calculated automatically. Prices are treated as tax-inclusive.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Country</Label>
              <Select value={country} onValueChange={onCountryChange}>
                <SelectTrigger className="mt-1 w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_PRESETS.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="60"
                step="0.5"
                className="mt-1 w-24"
                value={rate}
                disabled={country !== "custom"}
                onChange={(e) => update("custom", parseFloat(e.target.value || "0"))}
              />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Gross (this month)</p>
            <p className="mt-1 font-display text-xl font-semibold">${(grossThisMonth / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Tax ({rate}%)</p>
            <p className="mt-1 font-display text-xl font-semibold text-amber-600">-${(taxThisMonth / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Platform fees</p>
            <p className="mt-1 font-display text-xl font-semibold text-amber-600">-${(feesThisMonth / 100).toFixed(2)}</p>
          </div>
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="text-xs uppercase text-muted-foreground">You keep</p>
            <p className="mt-1 font-display text-xl font-semibold">${(netThisMonth / 100).toFixed(2)}</p>
          </div>
        </div>
      </Card>

      {/* Monthly chart */}
      <Card className="p-5">
        <p className="text-sm font-medium">Collected per month (last 6 months)</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="collected" fill="oklch(0.52 0.21 277)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {revenueByGroup.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Revenue by course</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {revenueByGroup.map((g: any) => (
              <Card key={g.id} className="overflow-hidden">
                <div className="h-1 w-full" style={{ backgroundColor: g.color }} />
                <div className="p-4">
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.memberCount} members · ${((g.price_cents || 0) / 100).toFixed(0)}/mo each</p>
                  <p className="mt-2 font-display text-xl font-semibold">${(g.total / 100).toFixed(0)} collected</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Recent invoices</h2>
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            {!payments.length && <p className="p-8 text-center text-sm text-muted-foreground">No payment records yet.</p>}
            {payments.slice(0, 20).map((p) => {
              const group = groupOfMember(p.member_id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">{nameOf(p.member_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {group?.name ?? "General"} · {format(new Date(p.period_month), "MMM yyyy")}
                      {p.paid_at && ` · paid ${format(new Date(p.paid_at), "MMM d")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold">${((p.amount_cents || 0) / 100).toFixed(2)}</p>
                    <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
                    {p.status !== "paid" && <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>Mark paid</Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
