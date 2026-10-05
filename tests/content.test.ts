import { describe, expect, it } from "vitest";
import { sanitizeCommentContent, sanitizePostContent, toPlainText } from "@/server/sanitize";
import { mentionsToPlainText, parseMentions } from "@/server/mentions";
import { formatThaiDate, formatThaiDateTime } from "@/server/time";
import { generateInviteCode, hashSecret, verifySecret } from "@/server/auth/password";

describe("sanitizePostContent", () => {
  it("keeps formatting that the composer produces", () => {
    const html = "<h2>หัวข้อ</h2><p><strong>ตัวหนา</strong> และ <em>ตัวเอียง</em></p><ul><li>ข้อ 1</li></ul>";
    expect(sanitizePostContent(html)).toContain("<h2>หัวข้อ</h2>");
    expect(sanitizePostContent(html)).toContain("<strong>ตัวหนา</strong>");
    expect(sanitizePostContent(html)).toContain("<li>ข้อ 1</li>");
  });

  it("removes script tags and inline handlers", () => {
    const dirty = '<p onclick="steal()">ข้อความ</p><script>alert(1)</script>';
    const clean = sanitizePostContent(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("ข้อความ");
  });

  it("forces outbound links to open safely", () => {
    const clean = sanitizePostContent('<a href="https://example.com">ลิงก์</a>');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });
});

describe("sanitizeCommentContent", () => {
  it("drops headings and images from comments", () => {
    const clean = sanitizeCommentContent('<h1>ใหญ่</h1><img src="x.png"><p>ปกติ</p>');
    expect(clean).not.toContain("<h1>");
    expect(clean).not.toContain("<img");
    expect(clean).toContain("ปกติ");
  });
});

describe("toPlainText", () => {
  it("strips markup and collapses whitespace", () => {
    expect(toPlainText("<p>สวัสดี</p>\n<p>ครับ</p>")).toBe("สวัสดี ครับ");
  });

  it("truncates to the requested length", () => {
    expect(toPlainText("<p>0123456789</p>", 5).length).toBeLessThanOrEqual(6);
  });
});

describe("parseMentions", () => {
  const id = "11111111-1111-1111-1111-111111111111";

  it("reads only real mention tokens", () => {
    const mentions = parseMentions(`สวัสดี @[สมชาย](user:${id}) และ @somchai`);
    expect(mentions).toEqual([{ kind: "user", id, label: "สมชาย" }]);
  });

  it("does not treat plain text as a mention", () => {
    expect(parseMentions("@ทุกคน ช่วยอ่านด้วย")).toEqual([]);
  });

  it("returns each target once", () => {
    const mentions = parseMentions(`@[สมชาย](user:${id}) @[สมชาย](user:${id})`);
    expect(mentions).toHaveLength(1);
  });

  it("renders mentions as readable text", () => {
    expect(mentionsToPlainText(`ถึง @[ฝ่ายบุคคล](department:${id})`)).toBe("ถึง @ฝ่ายบุคคล");
  });
});

describe("Thai date formatting", () => {
  it("writes the Bangkok date and time", () => {
    // 2026-09-29T07:35:00Z is 14:35 in Bangkok
    expect(formatThaiDateTime(new Date("2026-09-29T07:35:00.000Z"))).toBe("29 ก.ย. 2026 14:35");
    expect(formatThaiDate(new Date("2026-09-29T07:35:00.000Z"))).toBe("29 ก.ย. 2026");
  });

  it("uses the Bangkok day even late in UTC", () => {
    expect(formatThaiDate(new Date("2026-09-29T18:00:00.000Z"))).toBe("30 ก.ย. 2026");
  });
});

describe("secret hashing", () => {
  it("verifies a correct secret and rejects a wrong one", async () => {
    const hash = await hashSecret("hub-dev-admin");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifySecret("hub-dev-admin", hash)).toBe(true);
    expect(await verifySecret("wrong", hash)).toBe(false);
  });

  it("produces a different hash for the same secret", async () => {
    expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
  });

  it("generates invite codes without ambiguous characters", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(code).not.toMatch(/[OIL01]/);
  });
});
