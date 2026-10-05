import { env } from "@/server/env";

export type LineIdentity = {
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

/// LIFF path: the in-app browser hands over an access token. It is only trusted after LINE
/// confirms the token was issued for this channel.
export async function identityFromLiffAccessToken(accessToken: string): Promise<LineIdentity> {
  const verify = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!verify.ok) throw new Error("LINE ปฏิเสธ access token");
  const verified = (await verify.json()) as { client_id?: string; expires_in?: number };
  if (verified.client_id !== env().LINE_CHANNEL_ID) {
    throw new Error("access token ไม่ได้ออกให้แอปนี้");
  }
  if ((verified.expires_in ?? 0) <= 0) throw new Error("access token หมดอายุ");

  const profile = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profile.ok) throw new Error("อ่านโปรไฟล์ LINE ไม่สำเร็จ");
  const data = (await profile.json()) as {
    userId: string;
    displayName?: string;
    pictureUrl?: string;
  };
  return {
    lineUserId: data.userId,
    displayName: data.displayName ?? null,
    pictureUrl: data.pictureUrl ?? null,
  };
}

export function buildAuthorizeUrl(state: string, nonce: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env().LINE_CHANNEL_ID,
    redirect_uri: redirectUri,
    state,
    scope: "openid profile",
    nonce,
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/// Browser path: exchange the authorization code, then verify the id token with LINE.
export async function identityFromAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<LineIdentity> {
  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env().LINE_CHANNEL_ID,
      client_secret: env().LINE_CHANNEL_SECRET,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`แลก code กับ LINE ไม่สำเร็จ (${tokenResponse.status})`);
  }
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("LINE ไม่ส่ง id_token กลับมา");

  const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: tokens.id_token,
      client_id: env().LINE_CHANNEL_ID,
    }),
  });
  if (!verifyResponse.ok) throw new Error("ตรวจ id_token ไม่ผ่าน");
  const claims = (await verifyResponse.json()) as {
    sub: string;
    name?: string;
    picture?: string;
  };
  return {
    lineUserId: claims.sub,
    displayName: claims.name ?? null,
    pictureUrl: claims.picture ?? null,
  };
}
