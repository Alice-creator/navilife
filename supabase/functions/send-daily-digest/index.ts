import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createEmailService } from "../_shared/email-service.ts"

// Returns { date: "YYYY-MM-DD", time: "HH:MM" } in the given IANA timezone.
function getNowInTz(timezone: string): { date: string; time: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ""
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  }
}

function renderDigestHtml(userName: string, dateLabel: string, tasks: any[]): string {
  const rows = tasks.map((t) => {
    const time = t.start_time
      ? `${t.start_time.slice(0, 5)}${t.end_time ? " – " + t.end_time.slice(0, 5) : ""}`
      : "—"
    const priorityTag = t.priority
      ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;color:#fff;background:${
          t.priority === "high" ? "#F87171" : t.priority === "medium" ? "#F59E0B" : "#6B8AFF"
        };margin-right:6px;">${t.priority.toUpperCase()}</span>`
      : ""
    const points = t.points != null ? `<span style="font-size:11px;color:#A78BFA;margin-left:6px;">${t.points}pt</span>` : ""
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          <div style="font-size:14px;font-weight:500;color:#111;">${priorityTag}${escapeHtml(t.title)}${points}</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">${time}</div>
        </td>
      </tr>
    `
  }).join("")

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <div style="background:#0B0D13;color:#E2E4EA;padding:20px 24px;border-radius:10px;margin-bottom:16px;">
        <div style="font-size:12px;color:#7B819A;text-transform:uppercase;letter-spacing:0.08em;">Navilife</div>
        <h1 style="margin:6px 0 0;font-size:20px;">Good morning${userName ? ", " + escapeHtml(userName) : ""}!</h1>
        <div style="font-size:13px;color:#7B819A;margin-top:4px;">Here's your plan for ${dateLabel}</div>
      </div>
      ${tasks.length === 0
        ? `<div style="padding:24px;text-align:center;color:#666;background:#fafafa;border-radius:8px;">No tasks scheduled for today — enjoy the day!</div>`
        : `<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden;">${rows}</table>`
      }
      <div style="font-size:11px;color:#999;margin-top:20px;text-align:center;">Sent by Navilife — you can change or disable this in Settings.</div>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )
    const emailService = createEmailService()

    // Find all users with digest enabled
    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("user_id, timezone, daily_digest_time, daily_digest_last_sent")
      .eq("daily_digest_enabled", true)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    let sentCount = 0

    for (const s of settings) {
      const { date, time } = getNowInTz(s.timezone || "UTC")
      const digestTime = (s.daily_digest_time || "08:00").slice(0, 5)

      // Only send if current local time has reached the digest time, and we haven't sent today (in user's tz)
      if (time < digestTime) continue
      if (s.daily_digest_last_sent === date) continue

      // Get user email + name
      const { data: { user } } = await supabase.auth.admin.getUserById(s.user_id)
      if (!user?.email) continue
      const userName = user.user_metadata?.full_name || user.user_metadata?.name || ""

      // Fetch today's tasks (in user's timezone) — "today" is just `date` from getNowInTz
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, start_time, end_time, priority, points, status")
        .eq("user_id", s.user_id)
        .eq("date", date)
        .neq("status", "done")
        .order("start_time", { ascending: true, nullsFirst: false })

      const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })

      const result = await emailService.send({
        to: user.email,
        subject: `Your plan for ${dateLabel}`,
        html: renderDigestHtml(userName, dateLabel, tasks || []),
      })

      if (result.success) {
        await supabase
          .from("user_settings")
          .update({ daily_digest_last_sent: date })
          .eq("user_id", s.user_id)
        sentCount++
      } else {
        console.error(`Failed to send digest to ${user.email}: ${result.error}`)
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
