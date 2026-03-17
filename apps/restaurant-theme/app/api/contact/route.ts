import { NextRequest, NextResponse } from "next/server"
import { getSESService } from "@beindigital-engine/core"

interface ContactFormData {
  name: string
  email: string
  topic: string
  message: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ContactFormData

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: "Nom, email et message sont requis." },
        { status: 400 }
      )
    }

    const sesService = getSESService()

    // Send to the restaurant owner
    const toEmail = process.env.CONTACT_EMAIL ?? process.env.AWS_SES_FROM_EMAIL
    if (!toEmail) {
      return NextResponse.json(
        { error: "Configuration email manquante." },
        { status: 500 }
      )
    }

    await sesService.sendEmail({
      to: toEmail,
      subject: `[Contact] ${body.topic || "Message"} — ${body.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0D5C3F;">Nouveau message de contact</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666; width: 120px;">Nom</td>
              <td style="padding: 8px 0;">${body.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${body.email}">${body.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Sujet</td>
              <td style="padding: 8px 0;">${body.topic || "Non spécifié"}</td>
            </tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">
            ${body.message}
          </div>
        </div>
      `,
      text: `Nouveau message de contact\n\nNom: ${body.name}\nEmail: ${body.email}\nSujet: ${body.topic || "Non spécifié"}\n\nMessage:\n${body.message}`,
      replyTo: body.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du message." },
      { status: 500 }
    )
  }
}
