---
name: frontend-design
description: >-
  Designs Hub Communication Center screens for Thai employees. Use when
  creating or editing Feed, posts, knowledge, tasks, notifications, reports,
  or UI components. Keeps the solid Hub theme, Anuphan, and 44px targets.
---

# Frontend Design

Hub uses the scoped glass layer in `src/styles/hub-glass.css`. Do not import `liquid-glass.css` into the app. That file resets paragraphs, links, and focus.

## Before writing UI

1. Read `src/styles/hub-glass.css`. Reuse its tokens. Glass is only for the sidebar, top bar, and bottom bar. Content uses `.hub-card`.
2. Read [references/hub-thai-mobile.md](references/hub-thai-mobile.md) for Thai copy, 44px targets, the acknowledgement label, and status words. Ignore its old navy palette.

## Product rules

- Interface copy is Thai. The acknowledge button is `ฉันอ่านและรับทราบ`, then `รับทราบแล้ว` with the Bangkok timestamp.
- Read and acknowledged stay separate.
- Touch targets for primary actions are at least 44px.
- Do not add a marketing hero, WebGL, a custom cursor, or scroll-driven animation.
