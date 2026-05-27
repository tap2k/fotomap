import axios from 'axios';
import { parseCookies } from 'nookies';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { channelid, email } = req.body;

    if (!channelid || !email) {
        return res.status(400).json({
            error: 'Missing required parameters',
            details: 'Both channelid and email are required'
        });
    }

    const baseUrl = process.env.VIDEO_SERVER_URL;
    if (!baseUrl) {
        return res.status(503).json({ error: 'Video generation is not available' });
    }

    const mvcurl = process.env.NEXT_PUBLIC_STRAPI_HOST || "http://localhost:1337";

    // Tier enforcement: video generation is Pro+ only
    if (process.env.STRIPE_SECRET_KEY) {
        const cookies = parseCookies({ req });
        if (cookies.jwt) {
            try {
                const planRes = await axios.get(`${mvcurl}/getUserPlan`, {
                    headers: { Authorization: `Bearer ${cookies.jwt}` },
                });
                if (!planRes.data?.tierConfig?.videoGeneration)
                    return res.status(403).json({ error: 'Video generation requires a Pro or Enterprise plan.' });
            } catch (err) {
                return res.status(403).json({ error: 'Unable to verify plan. Please log in.' });
            }
        } else {
            return res.status(401).json({ error: 'Authentication required for video generation.' });
        }
    }

    try {
        // Video server spawns a background thread and returns 202 immediately.
        // It handles emailing the user when the video is done.
        await axios.post(`${baseUrl}/mvc_video`, {
            channelid, url: mvcurl, email
        });
        res.status(202).json({ message: 'Request accepted, processing started' });
    } catch (error) {
        console.error('Error dispatching video job:', error);
        res.status(500).json({ error: 'Failed to start video generation' });
    }
}