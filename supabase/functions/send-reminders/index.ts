import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { createEmailService } from "../_shared/email-service.ts"

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceKey)
    const emailService = createEmailService()

    // Find due unsent reminders (due now or in the past)
    const now = new Date().toISOString()
    const { data: reminders, error } = await supabase
      .from("reminders")
      .select(`
        id,
        remind_at,
        user_id,
        task_id,
        tasks ( title, date, start_time, end_time )
      `)
      .eq("sent", false)
      .lte("remind_at", now)
      .limit(50)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    let sentCount = 0

    for (const reminder of reminders) {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.admin.getUserById(reminder.user_id)
      if (!user?.email) continue

      const task = (reminder as any).tasks
      const taskTitle = task?.title || "Untitled task"
      const taskDate = task?.date || ""
      const taskTime = task?.start_time
        ? `${task.start_time.slice(0, 5)}${task.end_time ? " – " + task.end_time.slice(0, 5) : ""}`
        : ""

      const result = await emailService.send({
        to: user.email,
        subject: `Reminder: ${taskTitle}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #E2E4EA; background: #0B0D13; padding: 20px; border-radius: 8px; margin: 0 0 16px;">
              ⏰ Task Reminder
            </h2>
            <div style="padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
              <h3 style="margin: 0 0 8px;">${taskTitle}</h3>
              ${taskDate ? `<p style="margin: 4px 0; color: #666;">📅 ${taskDate}</p>` : ""}
              ${taskTime ? `<p style="margin: 4px 0; color: #666;">🕐 ${taskTime}</p>` : ""}
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 16px;">
              — Navilife
            </p>
          </div>
        `,
      })

      if (result.success) {
        await supabase.from("reminders").update({ sent: true }).eq("id", reminder.id)
        sentCount++
      } else {
        console.error(`Failed to send reminder ${reminder.id}: ${result.error}`)
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
