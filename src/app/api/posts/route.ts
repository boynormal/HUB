import { NextResponse } from "next/server";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { createPost, listManagedPosts, postInputSchema } from "@/server/post-editor";
import { jsonError, pagination, readJson } from "@/server/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const { take, skip } = pagination(url, 20, 100);
    const result = await listManagedPosts(actor, {
      status: url.searchParams.get("status"),
      take,
      skip,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const parsed = postInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const post = await createPost(actor, parsed.data, await clientIp());
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
