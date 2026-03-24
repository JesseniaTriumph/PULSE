import nodemailer from "nodemailer";

function createTransport() {
  // If SMTP env vars are set, use them; otherwise fall back to Ethereal (dev/test)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  // Ethereal test account — emails are captured at ethereal.email, not delivered
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: process.env.ETHEREAL_USER || "ethereal@example.com",
      pass: process.env.ETHEREAL_PASS || "",
    },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transport = createTransport();
  const from = process.env.EMAIL_FROM || "PULSE <noreply@pulse.app>";

  await transport.sendMail({
    from,
    to,
    subject: "Reset your PULSE password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Reset your password</h2>
        <p>Click the button below to reset your PULSE password. This link expires in 1 hour.</p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
        <p style="margin-top:24px;color:#6b7280;font-size:13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
        <p style="color:#6b7280;font-size:13px;">
          Or copy this link: <a href="${resetUrl}">${resetUrl}</a>
        </p>
      </div>
    `,
    text: `Reset your PULSE password by visiting: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });
}
