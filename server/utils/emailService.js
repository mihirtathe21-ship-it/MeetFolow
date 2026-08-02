import nodemailer from "nodemailer";

let transporterPromise = null;

// Lazily creates a real SMTP transporter if SMTP_HOST is set, otherwise
// spins up a free Ethereal test account so email sending works out of the
// box in development (nothing actually gets delivered, but you get a
// preview link in the server console).
const getTransporter = async () => {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }

    const testAccount = await nodemailer.createTestAccount();
    console.log("No SMTP_HOST set — using Ethereal test inbox for emails.");
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  })();

  return transporterPromise;
};

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || "MeetFlow <no-reply@meetflow.app>",
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`Email preview (${subject} -> ${to}): ${previewUrl}`);
    return info;
  } catch (err) {
    console.error("Email send failed:", err.message);
    // Don't crash the request just because email failed
    return null;
  }
};

export const meetingInviteTemplate = ({ hostName, title, startTime, link, meetingCode }) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
    <h2>${hostName} invited you to a meeting</h2>
    <p><strong>${title}</strong></p>
    <p>${new Date(startTime).toLocaleString()}</p>
    <p><a href="${link}" style="background:#4F46E5;color:#fff;padding:10px 16px;
       border-radius:6px;text-decoration:none;display:inline-block;">Join meeting</a></p>
    <p style="color:#666;font-size:13px;">Or use meeting code <b>${meetingCode}</b> on MeetFlow.</p>
  </div>
`;

export const reminderTemplate = ({ title, startTime, link }) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
    <h2>Reminder: your meeting starts soon</h2>
    <p><strong>${title}</strong></p>
    <p>Starting at ${new Date(startTime).toLocaleString()}</p>
    <p><a href="${link}">${link}</a></p>
  </div>
`;

export const passwordResetTemplate = ({ name, resetLink }) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
    <h2>Reset your MeetFlow password</h2>
    <p>Hi ${name}, click below to set a new password. This link expires in 1 hour.</p>
    <p><a href="${resetLink}" style="background:#4F46E5;color:#fff;padding:10px 16px;
       border-radius:6px;text-decoration:none;display:inline-block;">Reset password</a></p>
    <p style="color:#666;font-size:13px;">If you didn't request this, ignore this email.</p>
  </div>
`;
