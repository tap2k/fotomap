import axios from 'axios';

const formatEmailContent = (channelID, privateID, channelName) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'; 

  return `
  Your channel ${channelName} has been created successfully. Here are your channel links:

  Tagging Link: ${baseUrl}/tagger?privateid=${privateID}
  Upload Link: ${baseUrl}/upload?channelid=${channelID}
  Gallery Link: ${baseUrl}/reel?channelid=${channelID}

  Please save these links securely.
  `;
};

export default async function sendEmailLinks({channelID, privateID, channelName, email}) 
{ 
  if (!email)
    return;
  const body = formatEmailContent(channelID, privateID, channelName);
  await axios.post('/api/sendemail', {
    subject: "FOTOMAP: " + channelName,
    recipient: email,
    body: body
  }, {
      headers: { 'Content-Type': 'application/json' }
  });
}  
