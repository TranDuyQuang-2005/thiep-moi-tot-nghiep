import { put } from "@vercel/blob";

type Ceremony = { graduate: string; degree: string; date: string; time: string; venue: string; address: string; note: string; musicUrl?: string };
const limits = { graduate: 60, degree: 45, date: 10, time: 5, venue: 80, address: 100, note: 220 };

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return Response.json({ error: "Nội dung thiệp quá dài." }, { status: 413 });
    const data: unknown = await request.json();
    if (!data || typeof data !== "object") return Response.json({ error: "Dữ liệu thiệp không hợp lệ." }, { status: 400 });
    const { recipient, ceremony, ownerKey } = data as { recipient?: unknown; ceremony?: Record<string, unknown>; ownerKey?: unknown };
    if (typeof ownerKey !== "string" || !/^[a-f0-9]{64}$/.test(ownerKey)) return Response.json({ error: "Thiếu mã quản lý thiệp." }, { status: 400 });
    if (typeof recipient !== "string" || !recipient.trim() || recipient.length > 60 || !ceremony || typeof ceremony !== "object") return Response.json({ error: "Thiếu tên khách mời." }, { status: 400 });
    for (const [key, max] of Object.entries(limits)) {
      const value = ceremony[key];
      if (typeof value !== "string" || value.length > max) return Response.json({ error: "Thông tin buổi lễ không hợp lệ." }, { status: 400 });
    }
    const c = ceremony as Ceremony;
    if (c.musicUrl !== undefined && (typeof c.musicUrl !== "string" || c.musicUrl.length > 500 || (c.musicUrl && !/^https:\/\/[^\s]+\.(?:mp3|ogg|m4a|wav)(?:[?#][^\s]*)?$/i.test(c.musicUrl)))) return Response.json({ error: "Link nhạc cần là tệp âm thanh HTTPS công khai." }, { status: 400 });
    if (!c.graduate.trim() || !c.date || !c.time || !c.venue.trim() || !c.address.trim()) return Response.json({ error: "Vui lòng điền đủ thông tin buổi lễ." }, { status: 400 });
    const ownerHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ownerKey)))).map(b => b.toString(16).padStart(2, "0")).join("");
    const payload = JSON.stringify({ recipient: recipient.trim(), ceremony, ownerHash });
    if (payload.length > 4096) return Response.json({ error: "Nội dung thiệp quá dài." }, { status: 413 });
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
    await put(`invitations/${id}.json`, payload, {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json; charset=utf-8",
    });
    return Response.json({ id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Dữ liệu thiệp không hợp lệ." }, { status: 400 });
    console.error("Failed to create invitation", error);
    return Response.json({ error: "Chưa tạo được lời mời. Vui lòng thử lại." }, { status: 503 });
  }
}
