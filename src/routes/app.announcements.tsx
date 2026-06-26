import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Megaphone } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/app/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Syncletics" }] }),
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const { club, isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    enabled: !!club,
    queryKey: ["ann", club?.id],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").eq("club_id", club!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold">Announcements</h1>
          <p className="text-sm text-muted-foreground">Club-wide posts.</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-gradient-hero"><Plus className="mr-2 h-4 w-4" /> Post</Button></DialogTrigger>
            <NewAnn onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["ann"] }); }} />
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {data?.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">No announcements yet.</Card>}
        {data?.map((a) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Megaphone className="h-4 w-4" /></div>
              <div className="flex-1">
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm">{a.body}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewAnn({ onDone }: { onDone: () => void }) {
  const { club, user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    const { error } = await supabase.from("announcements").insert({ club_id: club.id, author_id: user.id, title, body });
    if (error) toast.error(error.message);
    else { toast.success("Posted"); onDone(); }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
        <div><Label>Body</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required /></div>
        <Button type="submit" className="w-full bg-gradient-hero">Post</Button>
      </form>
    </DialogContent>
  );
}
