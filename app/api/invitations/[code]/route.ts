import { get } from "@vercel/blob";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  if (!/^[a-f0-9]{16}$/.test(code)) return Response.json({ error: "Lời mời không hợp lệ." }, { status: 404 });
  try {
    const result = await get(`invitations/${code}.json`, { access: "private" });
    if (!result || result.statusCode !== 200) return Response.json({ error: "Không tìm thấy lời mời." }, { status: 404 });
    return new Response(result.stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("Failed to load invitation", error);
    return Response.json({ error: "Không tải được lời mời. Vui lòng thử lại." }, { status: 503 });
  }
}
