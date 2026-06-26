import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, KeyRound, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Syncletics" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, user, refresh } = useAuth();
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account details</p>
      </div>
      <ChangeNameCard displayName={profile?.display_name ?? ""} onSaved={refresh} />
      <ChangeEmailCard currentEmail={user?.email ?? ""} onSaved={refresh} />
      <ForgotPasswordCard email={user?.email ?? ""} />
    </div>
  );
}

function ChangeNameCard({
  displayName,
  onSaved,
}: {
  displayName: string;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      await onSaved();
      setSaved(true);
      toast.success("Name updated");
      setTimeout(() => setSaved(false), 2500);
    }
    setBusy(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Name &amp; Surname</p>
          <p className="text-xs text-muted-foreground">Update your display name</p>
        </div>
      </div>
      <Separator className="mb-4" />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="display-name">Full name</Label>
          <Input
            id="display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={busy || name.trim() === displayName}
          className="bg-gradient-hero"
        >
          {saved ? <><Check className="mr-2 h-4 w-4" /> Saved</> : busy ? "Saving…" : "Save name"}
        </Button>
      </form>
    </Card>
  );
}

function ChangeEmailCard({
  currentEmail,
  onSaved,
}: {
  currentEmail: string;
  onSaved: () => Promise<void>;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;
    setBusy(true);
    const { error: authErr } = await supabase.auth.updateUser({ email: email.trim() });
    if (authErr) { toast.error(authErr.message); setBusy(false); return; }
    await supabase.from("profiles").update({ email: email.trim() }).eq("id", user.id);
    await onSaved();
    setSent(true);
    toast.success("Confirmation email sent — check your inbox");
    setBusy(false);
  };

  if (sent) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Email address</p>
            <p className="text-xs text-muted-foreground">Confirm your new email to complete the change</p>
          </div>
        </div>
        <Separator className="mb-4" />
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          A confirmation link was sent to <strong>{email}</strong>. Open it to apply the change.
        </div>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSent(false)}>
          Change again
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Email address</p>
          <p className="text-xs text-muted-foreground">
            Current: <span className="font-medium text-foreground">{currentEmail}</span>
          </p>
        </div>
      </div>
      <Separator className="mb-4" />
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="new-email">New email address</Label>
          <Input
            id="new-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="new@email.com"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={busy || !email.trim() || email.trim() === currentEmail}
          className="bg-gradient-hero"
        >
          {busy ? "Sending…" : "Change email"}
        </Button>
      </form>
    </Card>
  );
}

function ForgotPasswordCard({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth?mode=reset",
    });
    if (error) { toast.error(error.message); }
    else { setSent(true); toast.success("Password reset email sent"); }
    setBusy(false);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center">
          <KeyRound className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Password</p>
          <p className="text-xs text-muted-foreground">
            Send a reset link to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
      </div>
      <Separator className="mb-4" />
      {sent ? (
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Check your inbox — a reset link was sent to <strong>{email}</strong>.
        </div>
      ) : (
        <Button variant="outline" onClick={send} disabled={busy}>
          <KeyRound className="mr-2 h-4 w-4" />
          {busy ? "Sending…" : "Send password reset email"}
        </Button>
      )}
    </Card>
  );
}
