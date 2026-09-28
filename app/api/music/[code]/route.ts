import { get } from "@vercel/blob";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-f0-9]{16}$/.test(code)) return new Response(null, { status: 404 });
  try {
    const invitation = await get(`invitations/${code}.json`, { access: "private" });
    if (!invitation || invitation.statusCode !== 200) return new Response(null, { status: 404 });
    const data = await new Response(invitation.stream).json() as { ceremony?: { musicUrl?: string } };
    const url = data.ceremony?.musicUrl;
    if (!url || !/^https:\/\/[^/]+\.private\.blob\.vercel-storage\.com\/music\/[a-z0-9-]+\.(mp3|ogg|m4a|wav)(?:\?.*)?$/i.test(url)) return new Response(null, { status: 404 });
    const music = await get(url, { access: "private" });
    if (!music || music.statusCode !== 200 || !music.blob.contentType.startsWith("audio/")) return new Response(null, { status: 404 });
    return new Response(music.stream, { headers: { "Content-Type": music.blob.contentType, "Content-Length": String(music.blob.size), "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
