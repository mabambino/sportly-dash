import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getEmbedStats = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ clubId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [clubRes, membersRes, slotsRes, attRes] = await Promise.all([
      supabaseAdmin.from("clubs").select("id, name, sport, monthly_fee_cents").eq("id", data.clubId).maybeSingle(),
      supabaseAdmin.from("memberships").select("role").eq("club_id", data.clubId),
      supabaseAdmin
        .from("time_slots")
        .select("id, title, starts_at, location")
        .eq("club_id", data.clubId)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(5),
      supabaseAdmin
        .from("attendance_records")
        .select("status, time_slots!inner(club_id)")
        .eq("time_slots.club_id", data.clubId),
    ]);

    if (!clubRes.data) throw new Error("Club not found");

    const members = membersRes.data || [];
    const students = members.filter((m) => m.role === "student").length;
    const trainers = members.filter((m) => m.role === "trainer" || m.role === "club_owner").length;
    const att = attRes.data || [];
    const present = att.filter((a) => a.status === "present").length;
    const attRate = att.length ? Math.round((present / att.length) * 100) : 0;

    return {
      club: clubRes.data,
      stats: { students, trainers, members: members.length, attRate },
      upcoming: slotsRes.data || [],
    };
  });

export const submitEmbedLead = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      clubId: z.string().uuid(),
      name: z.string().min(1),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional().or(z.literal("")),
      notes: z.string().optional().or(z.literal("")),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("leads").insert({
      club_id: data.clubId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      status: "new",
      source: "embed",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
