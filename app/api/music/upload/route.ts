import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

const types = ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/x-wav", "audio/wave"];

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        if (!/^music\/[a-f0-9-]{36}\.(mp3|ogg|m4a|wav)$/.test(pathname)) throw new Error("Tên tệp nhạc không hợp lệ.");
        return { allowedContentTypes: types, maximumSizeInBytes: 12 * 1024 * 1024, addRandomSuffix: true, validUntil: Date.now() + 5 * 60_000 };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Không thể tải nhạc lên." }, { status: 400 });
  }
}
