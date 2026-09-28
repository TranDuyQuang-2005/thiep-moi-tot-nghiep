import { get, list, put } from "@vercel/blob";

type Ceremony = { graduate: string; date: string; time: string; venue: string; address: string };
type ResponseEntry = { name: string; attendance: "yes" | "no" | "maybe"; message: string; submittedAt: string };

async function resolveInvitation(code: string) {
  if (!/^[a-f0-9]{16}$/.test(code)) return null;
  const result = await get(`invitations/${code}.json`, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  const data = await new Response(result.stream).json() as { ceremony: Ceremony; ownerHash?: string };
  const c = data.ceremony;
  if (!c || typeof c.graduate !== "string" || typeof c.date !== "string" || typeof c.time !== "string" || typeof c.venue !== "string" || typeof c.address !== "string") return null;
  return { prefix: data.ownerHash ? `responses/${code}/` : `wishes/${await legacyKey(c)}/`, ownerHash: data.ownerHash };
}

async function legacyKey(c: Ceremony) {
  const identity = [c.graduate, c.date, c.time, c.venue, c.address].map(value => value.trim().normalize("NFC").toLocaleLowerCase("vi")).join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest)).slice(0, 12).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const invitation = await resolveInvitation(code);
    if (!invitation) return Response.json({ error: "Không tìm thấy thiệp mời." }, { status: 404 });
    const key = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!invitation.ownerHash || !key || !/^[a-f0-9]{64}$/.test(key)) return Response.json({ error: "Chỉ người tạo thiệp được xem phản hồi." }, { status: 403 });
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))).map(b => b.toString(16).padStart(2, "0")).join("");
    if (hash !== invitation.ownerHash) return Response.json({ error: "Mã quản lý không hợp lệ." }, { status: 403 });
    const { blobs } = await list({ prefix: invitation.prefix, limit: 100 });
    const entries = await Promise.all(blobs.map(async blob => {
      try {
        const result = await get(blob.pathname, { access: "private" });
        return result?.statusCode === 200 ? await new Response(result.stream).json() as ResponseEntry : null;
      } catch { return null; }
    }));
    const responses = entries.filter((item): item is ResponseEntry => !!item && typeof item.name === "string" && typeof item.message === "string")
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 50);
    return Response.json({ responses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load responses", error);
    return Response.json({ error: "Chưa tải được lời chúc." }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 1500) return Response.json({ error: "Lời chúc quá dài." }, { status: 413 });
    const { code } = await context.params;
    const invitation = await resolveInvitation(code);
    if (!invitation) return Response.json({ error: "Không tìm thấy thiệp mời." }, { status: 404 });
    const data = await request.json() as { name?: unknown; attendance?: unknown; message?: unknown };
    if (!data || typeof data.name !== "string" || !data.name.trim() || data.name.length > 60 ||
        !["yes", "no", "maybe"].includes(String(data.attendance)) ||
        typeof data.message !== "string" || data.message.length > 300) {
      return Response.json({ error: "Vui lòng kiểm tra thông tin trước khi gửi." }, { status: 400 });
    }
    const entry: ResponseEntry = {
      name: data.name.trim().normalize("NFC"),
      attendance: data.attendance as ResponseEntry["attendance"],
      message: data.message.trim().normalize("NFC"),
      submittedAt: new Date().toISOString(),
    };
    await put(`${invitation.prefix}${code}.json`, JSON.stringify(entry), {
      access: "private", addRandomSuffix: false, allowOverwrite: true,
      contentType: "application/json; charset=utf-8", cacheControlMaxAge: 60,
    });
    return Response.json({ response: entry }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    console.error("Failed to save response", error);
    return Response.json({ error: "Chưa gửi được lời chúc. Vui lòng thử lại." }, { status: 503 });
  }
}
