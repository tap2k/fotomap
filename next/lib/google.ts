import { Google } from 'arctic';
import { appUrl } from '@/lib/auth';

export const googleEnabled = () => !!process.env.GOOGLE_CLIENT_ID;

export const google = () =>
  new Google(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, `${appUrl()}/api/auth/google/callback`);
