# Hub Thai and mobile rules

These rules override upstream art direction for the Communication Center. Read this file before writing UI.

## Language

- Set `<html lang="th">`.
- Use Anuphan for every UI string, numeral, and status label. Body weight 400. Buttons and headings weight 500 or 600. One family keeps Thai marks on the same line as the base letters.
- If Anuphan fails to load, fall back to IBM Plex Sans Thai, then Tahoma.
- Body line-height about 1.65. Do not set letter-spacing on Thai text. Body text on mobile is at least 16px.
- Write interface copy in Thai. Keep work terms employees already use, such as LINE and Feed.
- Format dates as `29 ก.ย. 2026 14:35` in `Asia/Bangkok`.
- The acknowledge button label is `ฉันอ่านและรับทราบ`. After confirmation show `รับทราบแล้ว` with the date and time.

## LINE and mobile

- The primary viewport is the LINE in-app browser, about 360–430px. Also check a tablet width and a desktop width.
- Reserve the bottom safe area for the LINE browser chrome.
- On the post detail screen, place อ่าน, รับทราบ, and แสดงความคิดเห็น in the thumb zone. Each target is at least 44px tall.
- Essential actions must work without hover.
- Feed cards stay short. Show the summary first. The full text opens on the detail screen.
- สำคัญ, ด่วน, and ค้างรับทราบ use words plus a mark. Do not use color alone.
- Honor `prefers-reduced-motion`.

## Color and theme

The app switches between a light theme and a dark theme. Default to `prefers-color-scheme`. Let the user override the choice and persist it. The accent hue is blue, with a different strength in each theme so text contrast meets WCAG 2.2 AA. Status colors are not the accent.

Light theme:

- Background `#F6F7F9`, surface `#FFFFFF`, text `#1A1D23`, muted text `#5C6570`, border `#E2E6EC`, accent `#1D4E89`

Dark theme:

- Background `#121418`, surface `#1C2026`, text `#F2F4F7`, muted text `#A7B0BA`, border `#2C333C`, accent `#8EBAE8`

Status labels, paired with color in both themes:

- ทั่วไป uses the muted text color
- สำคัญ uses amber
- ด่วน uses orange
- วิกฤต and เกินกำหนด use red
- รับทราบแล้ว uses green

Primary buttons and links use the accent only. Later screens use this same set.
