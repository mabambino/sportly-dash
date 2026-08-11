import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomPassword, randomToken } from "@/lib/random";

const FIRST_NAMES = ["Alex","Sam","Jordan","Taylor","Morgan","Casey","Riley","Quinn","Avery","Skyler","Drew","Reese"];
const LAST_NAMES = ["Lee","Garcia","Smith","Patel","Nguyen","Brown","Davis","Lopez","Khan","Kim","Walker","Reed"];

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clubId: string }) => z.object({ clubId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Seeding mints real, e-mail-confirmed auth users. That is fine in a
    // sandbox and unacceptable in production, so it is off by default there
    // and must be opted into explicitly.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
      throw new Error("Demo data seeding is disabled in production");
    }

    // verify caller owns club
    const { data: club } = await supabase.from("clubs").select("*").eq("id", data.clubId).maybeSingle();
    if (!club || club.owner_id !== userId) throw new Error("Not authorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create 2 trainers + 10 students
    const trainers: string[] = [];
    const students: { id: string; name: string }[] = [];

    for (let i = 0; i < 2; i++) {
      // .invalid is reserved by RFC 2606 and can never resolve, so demo
      // accounts cannot receive mail or collide with a real address.
      const email = `trainer${i + 1}.${randomToken()}@demo.syncletics.invalid`;
      const { data: u } = await supabaseAdmin.auth.admin.createUser({
        email, password: randomPassword(), email_confirm: true,
        user_metadata: { display_name: `Coach ${FIRST_NAMES[i]}`, demo: true },
      });
      if (u.user) {
        trainers.push(u.user.id);
        await supabaseAdmin.from("memberships").insert({ club_id: data.clubId, user_id: u.user.id, role: "trainer" });
      }
    }

    for (let i = 0; i < 10; i++) {
      const fn = FIRST_NAMES[i % FIRST_NAMES.length];
      const ln = LAST_NAMES[i % LAST_NAMES.length];
      const email = `student${i + 1}.${randomToken()}@demo.syncletics.invalid`;
      const { data: u } = await supabaseAdmin.auth.admin.createUser({
        email, password: randomPassword(), email_confirm: true,
        user_metadata: { display_name: `${fn} ${ln}`, demo: true },
      });
      if (u.user) {
        students.push({ id: u.user.id, name: `${fn} ${ln}` });
        await supabaseAdmin.from("memberships").insert({ club_id: data.clubId, user_id: u.user.id, role: "student" });
      }
    }

    // Sessions: 7 days of sessions
    const slots: { id: string; starts_at: string }[] = [];
    const now = new Date();
    for (let day = -3; day <= 3; day++) {
      const start = new Date(now);
      start.setDate(now.getDate() + day);
      start.setHours(17, 0, 0, 0);
      const end = new Date(start); end.setHours(18, 30);
      // day runs from -3, and JS % keeps the sign, so day % len can be
      // negative and index out of the array.
      const trainer =
        trainers.length > 0
          ? trainers[((day % trainers.length) + trainers.length) % trainers.length]
          : undefined;
      const { data: s } = await supabaseAdmin.from("time_slots").insert({
        club_id: data.clubId,
        title: day < 0 ? "Skills Training" : day === 0 ? "Today's Session" : "Practice",
        description: "Standard training session",
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: "Main Field",
        capacity: 20,
        trainer_id: trainer,
      }).select().single();
      if (s) slots.push({ id: s.id, starts_at: s.starts_at });
    }

    // RSVPs + attendance for past sessions
    for (const slot of slots) {
      const isPast = new Date(slot.starts_at) < now;
      const subset = students.slice(0, 7 + Math.floor(Math.random() * 3));
      for (const st of subset) {
        await supabaseAdmin.from("rsvps").insert({ slot_id: slot.id, user_id: st.id, status: "going" }).then(() => {});
        if (isPast) {
          const present = Math.random() > 0.15;
          await supabaseAdmin.from("attendance_records").insert({
            slot_id: slot.id, student_id: st.id,
            status: present ? "present" : "absent", marked_by: userId,
          }).then(() => {});
        }
      }
    }

    // Stats
    const metrics = ["Speed (m/s)", "Endurance (min)", "Skill rating"];
    for (const st of students) {
      for (const m of metrics) {
        for (let w = 0; w < 4; w++) {
          const d = new Date(); d.setDate(d.getDate() - w * 7);
          await supabaseAdmin.from("student_stats").insert({
            club_id: data.clubId, student_id: st.id, metric: m,
            value: 5 + Math.random() * 5 + (3 - w) * 0.5,
            recorded_at: d.toISOString(), recorded_by: userId,
          }).then(() => {});
        }
      }
    }

    // Chat channel + messages
    const { data: ch } = await supabaseAdmin.from("chat_channels").insert({
      club_id: data.clubId, name: "General", is_broadcast: false, created_by: userId,
    }).select().single();
    if (ch) {
      const msgs = [
        { sender: userId, text: "Welcome to the team chat! 👋" },
        { sender: trainers[0], text: "Great session today everyone — well done!" },
        { sender: students[0]?.id, text: "Thanks coach! See you Friday." },
        { sender: students[1]?.id, text: "Will the field change for next week?" },
        { sender: trainers[0], text: "Same field, same time. Bring water bottles." },
      ];
      for (const m of msgs) {
        if (!m.sender) continue;
        await supabaseAdmin.from("chat_messages").insert({
          channel_id: ch.id, sender_id: m.sender, content: m.text,
        }).then(() => {});
      }
    }

    // Payments — current month
    const period = new Date(); period.setDate(1);
    const periodStr = period.toISOString().slice(0, 10);
    for (let i = 0; i < students.length; i++) {
      const st = students[i];
      const paid = i % 4 !== 0; // 75% paid
      await supabaseAdmin.from("payments").insert({
        club_id: data.clubId, member_id: st.id,
        amount_cents: club.monthly_fee_cents,
        status: paid ? "paid" : "overdue",
        period_month: periodStr,
        paid_at: paid ? new Date().toISOString() : null,
      }).then(() => {});
    }

    // Announcements
    await supabaseAdmin.from("announcements").insert([
      { club_id: data.clubId, author_id: userId, title: "Welcome to the new season!", body: "We're thrilled to kick off the season. Check your schedule for upcoming sessions." },
      { club_id: data.clubId, author_id: userId, title: "New training gear available", body: "Order your new club jersey through the parents WhatsApp group." },
    ]);

    // Badges for top 3 students
    for (let i = 0; i < 3; i++) {
      const st = students[i];
      await supabaseAdmin.from("badges").insert({
        user_id: st.id, club_id: data.clubId,
        kind: "attendance", label: i === 0 ? "Perfect Month" : "10 sessions attended",
        icon: i === 0 ? "🏆" : "⭐",
      });
    }

    return { ok: true, trainers: trainers.length, students: students.length, sessions: slots.length };
  });
