import nodemailer from 'nodemailer';

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

/** Sends a plain-text email, or logs it when SMTP isn't configured (development). */
export async function sendMail(to: string, subject: string, text: string) {
  if (!transport) {
    console.log(`\n[mail] to=${to} subject=${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: process.env.MAIL_FROM ?? 'Fotomap <noreply@localhost>', to, subject, text });
}
