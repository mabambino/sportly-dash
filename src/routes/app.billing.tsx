import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { SensitiveValue } from "@/components/SensitiveValue";

export const Route = createFileRoute("/app/billing")({
  head: () => ({ meta: [{ title: "Billing — ClubHaus" }] }),
  component: BillingPage,
});

function BillingPage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();

  const { data: payments } = useQuery({
    enabled: !!club,
    queryKey: ["payments", club?.id, isStaff],
    queryFn: async () => {
      let q = supabase.from("payments").select("*").eq("club_id", club!.id);
      if (!isStaff) q = q.eq("member_id", user!.id);
      const { data } = await q.order("period_month", { ascending: false });
      const ids = Array.from(new Set((data || []).map((p) => p.member_id)));
      const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (data || []).map((p) => ({ ...p, member: profs?.find((x) => x.id === p.member_id) }));
    },
  });

  const markPaid = async (id: string) => {
    await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    toast.success("Marked as paid");
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  const payNow = async (id: string) => {
    // Mocked Stripe checkout flow
    toast.loading("Redirecting to checkout…", { id: "pay" });
    await new Promise((r) => setTimeout(r, 1200));
    await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    toast.success("Payment successful (demo)", { id: "pay" });
    qc.invalidateQueries({ queryKey: ["payments"] });
  };

  const total = (payments || []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_cents, 0) / 100;
  const overdue = (payments || []).filter((p) => p.status === "overdue").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Monthly fee: ${((club?.monthly_fee_cents ?? 0) / 100).toFixed(2)}</p>
      </div>

      {isStaff && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Collected</p><p className="mt-2 font-display text-3xl font-semibold"><SensitiveValue mask="$ ••••">{`$${total.toFixed(0)}`}</SensitiveValue></p></Card>
          <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Overdue</p><p className="mt-2 font-display text-3xl font-semibold text-destructive">{overdue}</p></Card>
          <Card className="p-5"><p className="text-xs uppercase text-muted-foreground">Total invoices</p><p className="mt-2 font-display text-3xl font-semibold">{payments?.length ?? 0}</p></Card>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {payments?.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No invoices yet.</p>}
          {payments?.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{isStaff ? p.member?.display_name : `${format(new Date(p.period_month), "MMMM yyyy")} fee`}</p>
                <p className="text-xs text-muted-foreground">
                  ${(p.amount_cents / 100).toFixed(2)} · {format(new Date(p.period_month), "MMM yyyy")}
                  {p.paid_at && ` · paid ${format(new Date(p.paid_at), "MMM d")}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={p.status === "paid" ? "default" : p.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
                {p.status !== "paid" && !isStaff && p.member_id === user?.id && (
                  <Button size="sm" className="bg-gradient-hero" onClick={() => payNow(p.id)}><CreditCard className="mr-2 h-3.5 w-3.5" /> Pay now</Button>
                )}
                {p.status !== "paid" && isStaff && (
                  <Button size="sm" variant="outline" onClick={() => markPaid(p.id)}><CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Mark paid</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        💳 Stripe test mode integration available — for now, "Pay now" simulates a successful checkout.
      </p>
    </div>
  );
}
