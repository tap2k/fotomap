import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import fs from 'fs';

// Initialize the JWT client
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const key = JSON.parse(fs.readFileSync(keyFile));
const jwtClient = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://mail.google.com/'],
  subject: process.env.SMTP_USER
});

// Helper function to get or refresh an access token
async function getAccessToken() {
  try {
    const currentToken = jwtClient.credentials.access_token;
    const expiryDate = jwtClient.credentials.expiry_date;

    if (!currentToken || !expiryDate || expiryDate <= Date.now()) {
      await jwtClient.authorize();
    }

    return jwtClient.credentials.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    throw error;
  }
}

export default async function sendEmail(subject, body, recipient) {
  const accessToken = await getAccessToken();

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: process.env.SMTP_USER,
      accessToken: accessToken
    }
  });

  const mailOptions = {
    from: {
      name: 'Fotomap',
      address: 'donotreply@represent.org'
    },
    to: recipient,
    subject: subject,
    text: body
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        reject(error);
      } else {
        console.log('Response email sent:', info.response);
        resolve(info);
      }
    });
  });
}

