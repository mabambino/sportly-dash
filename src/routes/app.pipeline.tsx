import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, ShieldCheck, MapPin } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/app/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — Syncletics" }] }),
  component: PipelinePage,
});

function PipelinePage() {
  const { club } = useAuth();

  const { data: members } = useQuery({
    enabled: !!club,
    queryKey: ["pipeline-members", club?.id],
    queryFn: async () => {
      const { data: mems } = await supabase.from("memberships").select("*").eq("club_id", club!.id);
      const ids = (mems || []).map((m) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      return (mems || []).map((m) => ({ ...m, profile: profs?.find((p) => p.id === m.user_id) }));
    },
  });

  const { data: slots } = useQuery({
    enabled: !!club,
    queryKey: ["pipeline-slots", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("time_slots").select("*").eq("club_id", club!.id).order("starts_at");
      return data || [];
    },
  });

  const students = (members || []).filter((m) => m.role === "student");
  const admins = (members || []).filter((m) => m.role === "club_owner" || m.role === "trainer");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Overview of athletes, sessions, and staff</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <PipelineColumn icon={Users} title="Athletes" count={students.length} color="blue">
          {students.length === 0 && <EmptyState message="No athletes registered yet." />}
          {students.map((m) => (<MemberCard key={m.id} name={m.profile?.display_name || "Unknown"} email={m.profile?.email || ""} role={m.role} joinedAt={m.joined_at} />))}
        </PipelineColumn>
        <PipelineColumn icon={Clock} title="Time Slots" count={slots?.length ?? 0} color="violet">
          {(slots?.length ?? 0) === 0 && <EmptyState message="No sessions scheduled yet." />}
          {slots?.map((s) => <SlotCard key={s.id} slot={s} />)}
        </PipelineColumn>
        <PipelineColumn icon={ShieldCheck} title="Admins" count={admins.length} color="green">
          {admins.length === 0 && <EmptyState message="No admins or trainers yet." />}
          {admins.map((m) => (<MemberCard key={m.id} name={m.profile?.display_name || "Unknown"} email={m.profile?.email || ""} role={m.role} joinedAt={m.joined_at} />))}
        </PipelineColumn>
      </div>
    </div>
  );
}

const colorMap = {
  blue: { header: "bg-blue-500/10 text-blue-600 dark:text-blue-400", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300", icon: "text-blue-500" },
  violet: { header: "bg-violet-500/10 text-violet-600 dark:text-violet-400", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300", icon: "text-violet-500" },
  green: { header: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: "text-emerald-500" },
};

function PipelineColumn({ icon: Icon, title, count, color, children }: { icon: typeof Users; title: string; count: number; color: keyof typeof colorMap; children: React.ReactNode }) {
  const c = colorMap[color];
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${c.header}`}>
        <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${c.icon}`} /><span className="font-semibold">{title}</span></div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.badge}`}>{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function MemberCard({ name, email, role, joinedAt }: { name: string; email: string; role: string; joinedAt: string }) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{name[0]?.toUpperCase() ?? "?"}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant="secondary" className="capitalize text-xs">{role.replace("_", " ")}</Badge>
        <span className="text-xs text-muted-foreground">{format(new Date(joinedAt), "MMM d, yyyy")}</span>
      </div>
    </Card>
  );
}

function SlotCard({ slot }: { slot: any }) {
  const past = new Date(slot.starts_at) < new Date();
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{slot.title}</p>
        {past ? <Badge variant="secondary" className="shrink-0 text-xs">Past</Badge> : <Badge className="shrink-0 text-xs bg-violet-500/15 text-violet-700 dark:text-violet-300 border-0">Upcoming</Badge>}
      </div>
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{format(new Date(slot.starts_at), "EEE MMM d, h:mm a")}</div>
        {slot.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{slot.location}</div>}
        <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />Capacity: {slot.capacity}</div>
      </div>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <Card className="p-5 text-center text-sm text-muted-foreground">{message}</Card>;
}
