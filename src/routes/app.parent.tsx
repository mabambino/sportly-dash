// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle2, XCircle, Users } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/parent")({
  head: () => ({ meta: [{ title: "Family — Syncletics" }] }),
  component: ParentPage,
});

function ParentPage() {
  const { club, user } = useAuth();

  const { data: children } = useQuery({
    enabled: !!club && !!user,
    queryKey: ["children", user?.id, club?.id],
    queryFn: async () => {
      const { data: mems } = await sb
        .from("memberships")
        .select("*")
        .eq("club_id", club!.id)
        .eq("parent_id", user!.id);
      if (!mems?.length) return [];
      const ids = mems.map((m) => m.user_id);
      const { data: profs } = await sb.from("profiles").select("*").in("id", ids);
      const { data: groups } = await sb.from("course_groups").select("*").eq("club_id", club!.id);
      return mems.map((m) => ({
        ...m,
        profile: profs?.find((p) => p.id === m.user_id),
        group: groups?.find((g) => g.id === m.group_id),
      }));
    },
  });

  const childIds = (children || []).map((c) => c.user_id);

  const { data: upcomingSlots } = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["parent-slots", club?.id],
    queryFn: async () => {
      const { data } = await sb
        .from("time_slots").select("*").eq("club_id", club!.id)
        .gte("starts_at", new Date().toISOString()).order("starts_at").limit(10);
      return data || [];
    },
  });

  const { data: rsvps } = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["parent-rsvps", childIds],
    queryFn: async () => {
      const { data } = await sb.from("rsvps").select("*").in("user_id", childIds);
      return data || [];
    },
  });

  const { data: attendance } = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["parent-attendance", childIds],
    queryFn: async () => {
      const { data } = await sb
        .from("attendance_records").select("*, time_slots(title, starts_at)")
        .in("student_id", childIds).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  const { data: progress } = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["parent-progress", childIds],
    queryFn: async () => {
      const { data } = await sb
        .from("progress_log").select("*, profiles!trainer_id(display_name)")
        .in("student_id", childIds).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const { data: payments } = useQuery({
    enabled: childIds.length > 0,
    queryKey: ["parent-payments", childIds],
    queryFn: async () => {
      const membershipIds = (children || []).map((c) => c.id);
      if (!membershipIds.length) return [];
      const { data } = await sb
        .from("payments").select("*, course_groups(name,color)")
        .in("membership_id", membershipIds).order("due_date", { ascending: false }).limit(10);
      return data || [];
    },
  });

  if (!children?.length) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold">Family Portal</h1>
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No children linked to your account yet. Ask the club admin to link your child.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Family Portal</h1>
        <p className="text-sm text-muted-foreground">{children.length} {children.length === 1 ? "child" : "children"} in {club?.name}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id} className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {child.profile?.display_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="font-semibold">{child.profile?.display_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{child.role.replace("_", " ")}</p>
                {child.group && (
                  <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: child.group.color }}>
                    {child.group.name}
                  </span>
                )}
              </div>
            </div>
            {child.group && (
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">{child.group.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {child.group.schedule_days?.join(", ")} · {child.group.schedule_time} · {child.group.session_duration_minutes} min
                </p>
                <p className="text-xs text-muted-foreground">${((child.group.price_cents || 0) / 100).toFixed(0)}/month</p>
              </div>
            )}
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><Calendar className="h-4 w-4" /> Upcoming Sessions</h2>
          <div className="space-y-2">
            {!upcomingSlots?.length && <p className="text-sm text-muted-foreground">No upcoming sessions.</p>}
            {upcomingSlots?.map((s) => {
              const hasRsvp = rsvps?.some((r) => r.slot_id === s.id && childIds.includes(r.user_id));
              return (
                <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" /> {format(new Date(s.starts_at), "EEE MMM d, h:mm a")}
                    </p>
                  </div>
                  <Badge variant={hasRsvp ? "default" : "outline"}>{hasRsvp ? "Going" : "Not RSVPd"}</Badge>
                </Card>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Attendance</h2>
          <div className="space-y-2">
            {!attendance?.length && <p className="text-sm text-muted-foreground">No attendance records yet.</p>}
            {attendance?.map((a) => (
              <Card key={a.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-sm">{a.time_slots?.title}</p>
                  <p className="text-xs text-muted-foreground">{a.time_slots?.starts_at ? format(new Date(a.time_slots.starts_at), "EEE MMM d") : ""}</p>
                </div>
                {a.status === "present" ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
              </Card>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Coach Notes</h2>
          <div className="space-y-2">
            {!progress?.length && <p className="text-sm text-muted-foreground">No coach notes yet.</p>}
            {progress?.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">{p.note}</p>
                  {p.skill_level && (
                    <div className="flex shrink-0 gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-2 w-2 rounded-full ${i < p.skill_level ? "bg-primary" : "bg-muted"}`} />
                      ))}
                    </div>
                  )}
                </div>
                {p.milestone && <Badge variant="secondary" className="mt-2">{p.milestone}</Badge>}
                <p className="mt-1 text-xs text-muted-foreground">By {p.profiles?.display_name} · {format(new Date(p.created_at), "MMM d, yyyy")}</p>
              </Card>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Payments</h2>
          <div className="space-y-2">
            {!payments?.length && <p className="text-sm text-muted-foreground">No payment records yet.</p>}
            {payments?.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-sm">{p.course_groups?.name ?? "General"}</p>
                  <p className="text-xs text-muted-foreground">{p.due_date ? `Due ${format(new Date(p.due_date), "MMM d, yyyy")}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${((p.amount_cents || 0) / 100).toFixed(2)}</p>
                  <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="text-xs capitalize">{p.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
                    }
