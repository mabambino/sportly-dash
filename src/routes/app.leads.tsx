// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Mail, Calendar } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/leads")({
  head: () => ({ meta: [{ title: "Leads — ClubHaus" }] }),
  component: LeadsPage,
});

const COLUMNS = [
  { id: "lead", label: "Leads", color: "bg-blue-500" },
  { id: "trial", label: "Trial", color: "bg-amber-500" },
  { id: "converted", label: "Converted", color: "bg-green-500" },
  { id: "lost", label: "Lost", color: "bg-muted-foreground" },
];
const NEXT_STATUS: Record<string, string> = { lead: "trial", trial: "converted" };

function LeadsPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: leads } = useQuery({
    enabled: !!club,
    queryKey: ["leads", club?.id],
    queryFn: async () => {
      const { data } = await sb.from("leads").select("*").eq("club_id", club!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });
  const advance = async (lead: any) => {
    const next = NEXT_STATUS[lead.status];
    if (!next) return;
    await sb.from("leads").update({ status: next, updated_at: new Date().toISOString() }).eq("id", lead.id);
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success(`Moved to ${next}`);
  };
  const markLost = async (id: string) => {
    await sb.from("leads").update({ status: "lost", updated_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["leads"] });
    toast.success("Marked as lost");
  };
  if (!isStaff) return <Card className="p-8 text-center text-muted-foreground">Only staff can view leads.</Card>;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h1 className="font-display text-3xl font-semibold">Leads</h1><p className="text-sm text-muted-foreground">Track prospects and trial conversions</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Add lead</Button></DialogTrigger>
          <AddLeadDialog clubId={club!.id} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["leads"] }); }} />
        </Dialog>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((col) => {
          const colLeads = (leads || []).filter((l: any) => l.status === col.id);
          return (
            <div key={col.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.color}`} />
                <span className="font-medium text-sm">{col.label}</span>
                <Badge variant="secondary" className="ml-auto">{colLeads.length}</Badge>
              </div>
              <div className="space-y-2">
                {colLeads.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Empty</div>}
                {colLeads.map((lead: any) => (
                  <Card key={lead.id} className="p-3 space-y-2">
                    <p className="font-medium text-sm">{lead.name}</p>
                    {lead.sport && <p className="text-xs text-muted-foreground">{lead.sport}</p>}
                    <div className="space-y-1">
                      {lead.email && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{lead.email}</p>}
                      {lead.phone && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{lead.phone}</p>}
                      {lead.trial_date && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />Trial: {format(new Date(lead.trial_date), "MMM d")}</p>}
                    </div>
                    {lead.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{lead.notes}</p>}
                    <div className="flex gap-1.5 pt-1">
                      {NEXT_STATUS[lead.status] && <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => advance(lead)}>Move to {NEXT_STATUS[lead.status]}</Button>}
                      {lead.status !== "lost" && lead.status !== "converted" && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => markLost(lead.id)}>Lost</Button>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddLeadDialog({ clubId, onDone }: { clubId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sport, setSport] = useState("");
  const [notes, setNotes] = useState("");
  const [trialDate, setTrialDate] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await sb.from("leads").insert({
      club_id: clubId, name, email: email || null, phone: phone || null,
      sport: sport || null, notes: notes || null,
      trial_date: trialDate ? new Date(trialDate).toISOString() : null,
      status: "lead",
    });
    if (error) toast.error(error.message);
    else { toast.success("Lead added"); onDone(); }
    setBusy(false);
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add lead</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Smith" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Sport</Label><Input value={sport} onChange={(e) => setSport(e.target.value)} /></div>
          <div><Label>Trial date</Label><Input type="date" value={trialDate} onChange={(e) => setTrialDate(e.target.value)} /></div>
        </div>
        <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></div>
        <Button type="submit" disabled={busy} className="w-full bg-gradient-hero">{busy ? "Adding…" : "Add lead"}</Button>
      </form>
    </DialogContent>
  );
}
