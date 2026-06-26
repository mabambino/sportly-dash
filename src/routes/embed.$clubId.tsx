import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getEmbedStats, submitEmbedLead } from "@/lib/embed.functions";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/embed/$clubId")({
  head: () => ({ meta: [{ title: "Register — Syncletics" }] }),
  component: EmbedWidget,
});

function EmbedWidget() {
  const { clubId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["embed", clubId],
    queryFn: () => getEmbedStats({ data: { clubId } }),
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const update = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: any) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Please enter your name."); return; }
    setBusy(true);
    setErr("");
    try {
      await submitEmbedLead({ data: { clubId, name: form.name, email: form.email, phone: form.phone, notes: form.notes } });
      setDone(true);
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Club not found</div>;

  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{data.club.sport || "Sports club"}</p>
          <h1 className="font-display text-2xl font-semibold">Join {data.club.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register your interest and the team will be in touch.</p>
        </div>

        {done ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Thanks, {form.name.split(" ")[0] || "there"}!</p>
            <p className="mt-1 text-sm text-muted-foreground">Your registration was sent to {data.club.name}. They'll reach out soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <Field label="Full name *">
              <input value={form.name} onChange={update("name")} required placeholder="Jane Doe" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={update("email")} placeholder="jane@email.com" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={update("phone")} placeholder="+1 555 123 4567" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            <Field label="Anything we should know?">
              <textarea value={form.notes} onChange={update("notes")} rows={3} placeholder="Age, experience, preferred days…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
            </Field>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-hero px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Sending…" : "Register"}
            </button>
          </form>
        )}

        <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">Powered by Syncletics</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
