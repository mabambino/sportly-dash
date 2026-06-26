import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Clock, DollarSign, MessageSquare, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/groups")({
  head: () => ({ meta: [{ title: "Groups — Syncletics" }] }),
  component: GroupsPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function GroupsPage() {
  const { club, isStaff, user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<any>(null);

  const { data: groups } = useQuery({
    enabled: !!club,
    queryKey: ["groups", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_groups")
        .select("*")
        .eq("club_id", club!.id)
        .order("created_at");
      return data || [];
    },
  });

  const { data: memberships } = useQuery({
    enabled: !!club,
    queryKey: ["group-memberships", club?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("*, profiles(display_name, email)")
        .eq("club_id", club!.id);
      return data || [];
    },
  });

  const deleteGroup = async (group: any) => {
    if (!confirm(`Delete "${group.name}"? This will remove group assignment from all members.`)) return;
    const { error } = await supabase.from("course_groups").delete().eq("id", group.id);
    if (error) { toast.error(error.message); return; }
    if (group.chat_channel_id) {
      await supabase.from("chat_channels").delete().eq("id", group.chat_channel_id);
    }
    qc.invalidateQueries({ queryKey: ["groups"] });
    toast.success("Group deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Course Groups</h1>
          <p className="text-sm text-muted-foreground">
            {groups?.length ?? 0} groups · each with its own pricing, schedule, and chat
          </p>
        </div>
        {isStaff && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-hero">
                <Plus className="mr-2 h-4 w-4" /> New group
              </Button>
            </DialogTrigger>
            <GroupDialog
              club={club}
              user={user}
              onDone={() => { setCreateOpen(false); qc.invalidateQueries({ queryKey: ["groups"] }); qc.invalidateQueries({ queryKey: ["group-memberships"] }); }}
            />
          </Dialog>
        )}
      </div>

      {editGroup && (
        <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
          <GroupDialog
            club={club}
            user={user}
            existing={editGroup}
            onDone={() => { setEditGroup(null); qc.invalidateQueries({ queryKey: ["groups"] }); }}
          />
        </Dialog>
      )}

      {groups?.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-muted-foreground text-sm">No course groups yet. Create one to set up pricing, schedules, and group chats.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups?.map((g) => {
          const members = (memberships || []).filter((m) => m.group_id === g.id);
          return (
            <Card key={g.id} className="overflow-hidden">
              {/* Color bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: g.color }} />
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base">{g.name}</h3>
                    {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                  </div>
                  {isStaff && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditGroup(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteGroup(g)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatPill icon={DollarSign} label="Price / month" value={`$${(g.price_cents / 100).toFixed(0)}`} />
                  <StatPill icon={Clock} label="Duration" value={`${g.session_duration_minutes} min`} />
                  <StatPill icon={Users} label="Members" value={members.length} />
                  <StatPill icon={MessageSquare} label="Group chat" value={g.chat_channel_id ? "Active" : "None"} />
                </div>

                {g.schedule_days?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Schedule</p>
                    <div className="flex flex-wrap gap-1">
                      {DAYS.map((d) => (
                        <span
                          key={d}
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            g.schedule_days.includes(d)
                              ? "text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                          style={g.schedule_days.includes(d) ? { backgroundColor: g.color } : {}}
                        >
                          {d}
                        </span>
                      ))}
                      {g.schedule_time && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          @ {g.schedule_time}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {members.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Members</p>
                    <div className="flex flex-wrap gap-1">
                      {members.slice(0, 5).map((m: any) => (
                        <div
                          key={m.id}
                          title={m.profiles?.display_name}
                          className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        >
                          {m.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                      ))}
                      {members.length > 5 && (
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs text-muted-foreground">
                          +{members.length - 5}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function GroupDialog({
  club,
  user,
  existing,
  onDone,
}: {
  club: any;
  user: any;
  existing?: any;
  onDone: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [priceDollars, setPriceDollars] = useState(existing ? String(existing.price_cents / 100) : "0");
  const [duration, setDuration] = useState(existing?.session_duration_minutes ?? 60);
  const [time, setTime] = useState(existing?.schedule_time ?? "09:00");
  const [days, setDays] = useState<string[]>(existing?.schedule_days ?? []);
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [busy, setBusy] = useState(false);

  const toggleDay = (d: string) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    setBusy(true);
    const price_cents = Math.round(parseFloat(priceDollars || "0") * 100);

    if (existing) {
      // Update
      const { error } = await supabase.from("course_groups").update({
        name, description, price_cents,
        session_duration_minutes: Number(duration),
        schedule_days: days, schedule_time: time, color,
      }).eq("id", existing.id);
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Group updated");
      onDone();
    } else {
      // Create chat channel first
      const { data: channel, error: chErr } = await supabase
        .from("chat_channels")
        .insert({ club_id: club.id, name: `${name} · Group Chat`, created_by: user.id })
        .select()
        .single();
      if (chErr) { toast.error("Could not create group chat: " + chErr.message); setBusy(false); return; }

      const { error } = await supabase.from("course_groups").insert({
        club_id: club.id, name, description, price_cents,
        session_duration_minutes: Number(duration),
        schedule_days: days, schedule_time: time, color,
        chat_channel_id: channel.id,
      });
      if (error) { toast.error(error.message); setBusy(false); return; }
      toast.success("Group created with dedicated chat channel");
      onDone();
    }
    setBusy(false);
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{existing ? "Edit group" : "New course group"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Group name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Beginner Adults" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Monthly price ($)</Label>
            <div className="relative">
              <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" type="number" min="0" step="0.01" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Session duration (min)</Label>
            <Input type="number" min="15" step="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <Label>Session start time</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div>
          <Label>Schedule days</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days.includes(d)
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
                style={days.includes(d) ? { backgroundColor: color } : {}}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Group color</Label>
          <div className="flex gap-2 mt-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {!existing && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            A dedicated group chat channel will be created automatically when you save.
          </div>
        )}

        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">
          {busy ? (existing ? "Saving…" : "Creating…") : (existing ? "Save changes" : "Create group")}
        </Button>
      </form>
    </DialogContent>
  );
}
