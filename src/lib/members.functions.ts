import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomPassword } from "@/lib/random";

const AddMemberInput = z.object({
  clubId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: z.enum(["student", "trainer", "parent"]),
  groupId: z.string().uuid().nullable().optional(),
});

/**
 * Staff-only: add a member to a club by email.
 * - If an account with that email already exists, it is enrolled directly.
 * - Otherwise a new account is created with a temporary password that is
 *   returned once so the admin can hand it to the member.
 */
export const addMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddMemberInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Caller must be staff of this club (checked with the caller's own
    // RLS-scoped client, so it can't be spoofed).
    const { data: mem } = await supabase
      .from("memberships")
      .select("role")
      .eq("club_id", data.clubId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || !["club_owner", "trainer"].includes(mem.role)) {
      throw new Error("Only club staff can add members");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let targetUserId = existing?.id ?? null;
    let tempPassword: string | null = null;
    // Only accounts we create in this request may be rolled back on failure —
    // never an account that already existed.
    let createdUserId: string | null = null;

    if (!targetUserId) {
      // Cryptographically secure: this password is a real credential for the
      // new account until the member changes it.
      tempPassword = randomPassword();
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { display_name: data.displayName.trim() },
      });
      if (error || !created.user) throw new Error(error?.message || "Could not create the account");
      targetUserId = created.user.id;
      createdUserId = created.user.id;
    }

    // If anything below fails we must not leave a half-provisioned account
    // behind: an orphaned auth user blocks the admin from retrying, because
    // the e-mail is then taken but has no membership.
    const rollback = async () => {
      if (createdUserId) {
        await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
      }
    };

    const { data: already } = await supabaseAdmin
      .from("memberships")
      .select("id")
      .eq("club_id", data.clubId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (already) {
      await rollback();
      throw new Error("This person is already a member of the club");
    }

    const { error: memErr } = await supabaseAdmin.from("memberships").insert({
      club_id: data.clubId,
      user_id: targetUserId,
      role: data.role,
      group_id: data.groupId ?? null,
    });
    if (memErr) {
      await rollback();
      throw new Error(memErr.message);
    }

    return {
      ok: true,
      userId: targetUserId,
      existingAccount: !!existing,
      tempPassword,
    };
  });
