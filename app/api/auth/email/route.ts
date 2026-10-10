import { z } from 'zod';
import { route } from '@/lib/http';
import { sendLoginLink } from '@/lib/auth';

export const POST = route(async (req) => {
  const { email, next } = z.object({ email: z.email(), next: z.string().optional() }).parse(await req.json());
  await sendLoginLink(email, next);
  return { ok: true };
});
