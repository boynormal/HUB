"use client";

import { useEffect, useRef } from "react";

/// Opening the post marks it read. Acknowledgement stays a separate, explicit action.
export function MarkRead({ postId, alreadyRead }: { postId: string; alreadyRead: boolean }) {
  const sent = useRef(false);

  useEffect(() => {
    if (alreadyRead || sent.current) return;
    sent.current = true;
    void fetch(`/api/posts/${postId}/read`, { method: "POST" });
  }, [postId, alreadyRead]);

  return null;
}
