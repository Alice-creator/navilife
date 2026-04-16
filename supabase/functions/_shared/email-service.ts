// ─── Email Service Interface ─────────────────────────────────────────────────
// Swap implementations by changing the export at the bottom of this file.
// Each provider must implement the EmailService interface.

export interface EmailPayload {
  to: string
  subject: string
  html: string
}

export interface EmailService {
  send(payload: EmailPayload): Promise<{ success: boolean; error?: string }>
}

// ─── Resend ──────────────────────────────────────────────────────────────────

export class ResendEmailService implements EmailService {
  private apiKey: string
  private from: string

  constructor(apiKey: string, from = "Navilife <onboarding@resend.dev>") {
    this.apiKey = apiKey
    this.from = from
  }

  async send(payload: EmailPayload) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { success: false, error: `Resend ${res.status}: ${body}` }
    }

    return { success: true }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────
// Add new providers here and switch the default.

export function createEmailService(): EmailService {
  const provider = Deno.env.get("EMAIL_PROVIDER") || "resend"

  switch (provider) {
    case "resend": {
      const apiKey = Deno.env.get("RESEND_API_KEY")
      if (!apiKey) throw new Error("RESEND_API_KEY not set")
      const from = Deno.env.get("EMAIL_FROM") || "Navilife <onboarding@resend.dev>"
      return new ResendEmailService(apiKey, from)
    }
    // case "sendgrid": {
    //   return new SendGridEmailService(...)
    // }
    default:
      throw new Error(`Unknown email provider: ${provider}`)
  }
}
