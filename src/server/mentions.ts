export type MentionKind = "user" | "department" | "branch" | "group";

export type ParsedMention = {
  kind: MentionKind;
  id: string;
  label: string;
};

const MENTION_PATTERN = /@\[([^\]]{1,80})\]\((user|department|branch|group):([0-9a-fA-F-]{36})\)/g;

/// The composer inserts mentions as `@[ชื่อ](user:<uuid>)`. Free typed text is never treated
/// as a mention, so nobody can notify a whole branch by writing plain words.
export function parseMentions(content: string): ParsedMention[] {
  const found = new Map<string, ParsedMention>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    const [, label, kind, id] = match;
    found.set(`${kind}:${id}`, { kind: kind as MentionKind, id, label });
  }
  return [...found.values()];
}

/// Replaces mention tokens with readable text for plain-text contexts such as LINE push.
export function mentionsToPlainText(content: string): string {
  return content.replace(MENTION_PATTERN, (_match, label: string) => `@${label}`);
}
