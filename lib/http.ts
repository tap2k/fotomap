import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

/** Wraps a route handler: returns JSON, maps HttpError/ZodError to status codes. */
export function route<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      // Writes must come from our own pages (defence in depth on top of SameSite cookies).
      const origin = req.headers.get('origin');
      if (req.method !== 'GET' && origin && !sameSite(origin, req)) fail(403, 'Cross-site request');
      const result = await handler(req, ctx);
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError)
        return NextResponse.json({ error: 'Invalid input', issues: err.issues }, { status: 400 });
      console.error(err);
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
  };
}

function sameSite(origin: string, req: Request) {
  const host = new URL(origin).host;
  return host === new URL(req.url).host || host === req.headers.get('host') || (!!process.env.APP_URL && host === new URL(process.env.APP_URL).host);
}
