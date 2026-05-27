import sendEmail from "../../hooks/sendemail";

export default async function handler(req, res) {
  // Check if the request method is POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Check if the request is coming from your own pages
  const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
  const origin = req.headers.origin;

  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { subject, body, recipient } = req.body;

    if (!subject || !body || !recipient) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    await sendEmail(subject, body, recipient);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'An error occurred while sending the email' });
  }
}