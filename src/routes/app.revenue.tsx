import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, AlertCircle, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/revenue")({
  head: () => ({ meta: [{ title: "Revenue — ClubHaus" }] }),
  component: RevenuePage,
});

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
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

  const { data: payments, refetch } = useQuery({
    enabled: !!club,
    queryKey: ["payments", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, course_groups(name,color), memberships(user_id, profiles(display_name))")
        .eq("club_id", club!.id).order("due_date", { ascending: false });
      return data || [];
    },
  });

  const { data: groups } = useQuery({
    enabled: !!club,
    queryKey: ["groups", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("course_groups").select("*").eq("club_id", club!.id);
      return data || [];
    },
  });

  const { data: memberships } = useQuery({
    enabled: !!club,
    queryKey: ["members", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, profiles(display_name), course_groups(name,color,price_cents)")
        .eq("club_id", club!.id).neq("role", "club_owner");
      return data || [];
    },
  });

  if (!isStaff) return <Card className="p-8 text-center text-sm text-muted-foreground">Access restricted to staff.</Card>;

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const paidThisMonth = (payments || []).filter(
    (p: any) => p.status === "paid" && p.paid_at && new Date(p.paid_at) >= thisMonthStart && new Date(p.paid_at) <= thisMonthEnd
  );
  const paidLastMonth = (payments || []).filter(
    (p: any) => p.status === "paid" && p.paid_at && new Date(p.paid_at) >= lastMonthStart && new Date(p.paid_at) <= lastMonthEnd
  );
  const pending = (payments || []).filter((p: any) => p.status === "pending");
  const thisMonthTotal = paidThisMonth.reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
  const lastMonthTotal = paidLastMonth.reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
  const pendingTotal = pending.reduce((s: number, p: any) => s + (p.amount_cents || 0), 0);
  const mrr = (memberships || []).reduce((s: number, m: any) => s + (m.course_groups?.price_cents || 0), 0);
  const paidMemberIds = new Set(paidThisMonth.map((p: any) => p.memberships?.user_id));
  const unpaidMembers = (memberships || []).filter((m: any) => m.group_id && !paidMemberIds.has(m.user_id));
  const revenueByGroup = (groups || []).map((g: any) => {
    const gp = (payments || []).filter((p: any) => p.group_id === g.id && p.status === "paid");
    return { ...g, total: gp.reduce((s: number, p: any) => s + (p.amount_cents || 0), 0), memberCount: (memberships || []).filter((m: any) => m.group_id === g.id).length };
  });

  const markPaid = async (id: string) => {
    const { error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Marked as paid"); refetch(); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Revenue</h1>
        <p className="text-sm text-muted-foreground">Financial overview for {club?.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value={`$${(mrr / 100).toFixed(0)}`} icon={TrendingUp} sub="Monthly recurring revenue" />
        <StatCard label="This month" value={`$${(thisMonthTotal / 100).toFixed(0)}`} icon={DollarSign} sub={`vs $${(lastMonthTotal / 100).toFixed(0)} last month`} />
        <StatCard label="Pending" value={`$${(pendingTotal / 100).toFixed(0)}`} icon={AlertCircle} sub={`${pending.length} invoices outstanding`} />
        <StatCard label="Unpaid members" value={String(unpaidMembers.length)} icon={Users} sub="With a group, no payment this month" />
      </div>
      {revenueByGroup.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Revenue by Group</h2>
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
      {unpaidMembers.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /> Unpaid This Month</h2>
          <Card className="overflow-hidden p-0">
            <div className="divide-y divide-border">
              {unpaidMembers.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{m.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}</div>
                    <div>
                      <p className="font-medium text-sm">{m.profiles?.display_name}</p>
                      {m.course_groups && <span className="text-xs text-muted-foreground">{m.course_groups.name} · ${((m.course_groups.price_cents || 0) / 100).toFixed(0)}/mo</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">Unpaid</Badge>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Recent Payments</h2>
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-border">
            {!(payments || []).length && <p className="p-8 text-center text-sm text-muted-foreground">No payment records yet.</p>}
            {(payments || []).slice(0, 20).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                <div>
                  <p className="font-medium text-sm">{p.memberships?.profiles?.display_name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{p.course_groups?.name ?? "General"} · {p.due_date ? format(new Date(p.due_date), "MMM d, yyyy") : "No due date"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold">${((p.amount_cents || 0) / 100).toFixed(2)}</p>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
                  {p.status === "pending" && <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}>Mark paid</Button>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
    }
