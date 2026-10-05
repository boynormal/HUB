export type MentionKind = "user" | "department" | "branch" | "group" | "all";

export type ParsedMention = {
  kind: MentionKind;
  id: string;
  label: string;
};

function mentionPattern() {
  return /@\[([^\]]{1,80})\]\((user|department|branch|group|all):([0-9a-fA-F-]{36})\)/g;
}

/// The composer inserts mentions as `@[ชื่อ](user:<uuid>)`. Free typed text is never treated
/// as a mention, so nobody can notify a whole branch by writing plain words.
export function parseMentions(content: string): ParsedMention[] {
  const found = new Map<string, ParsedMention>();
  for (const match of content.matchAll(mentionPattern())) {
    const [, label, kind, id] = match;
    found.set(`${kind}:${id}`, { kind: kind as MentionKind, id, label });
  }
  return [...found.values()];
}

/// Replaces mention tokens with readable text for plain-text contexts such as LINE push.
export function mentionsToPlainText(content: string): string {
  return content.replace(mentionPattern(), (_match, label: string) => `@${label}`).replace(/@\[[^\]]+\]\([^)]+\)/g, (token) => {
    const label = /@\[([^\]]+)\]/.exec(token)?.[1] ?? "";
    return label ? `@${label}` : token;
  });
}

/// Turns a visible `@ชื่อ` back into the stored token, using mentions already chosen.
export function restoreMentions(plain: string, previous: string): string {
  let result = plain;
  for (const mention of parseMentions(previous)) {
    const needle = `@${mention.label}`;
    const token = `@[${mention.label}](${mention.kind}:${mention.id})`;
    const index = result.indexOf(needle);
    if (index < 0) continue;
    result = `${result.slice(0, index)}${token}${result.slice(index + needle.length)}`;
  }
  return result;
}

/// Shows `@ชื่อ` in rendered HTML. The id stays in storage so the mention still notifies.
export function mentionTokensToHtml(html: string): string {
  return html.replace(mentionPattern(), (_match, label: string) => {
    const safe = label
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<span class="font-medium text-accent">@${safe}</span>`;
  });
}
