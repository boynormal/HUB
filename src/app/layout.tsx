import type { Metadata, Viewport } from "next";
import { Anuphan, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hub ศูนย์กลางการสื่อสาร",
  description: "ศูนย์กลางการสื่อสารองค์กร ส.เจริญชัย รีไซเคิล",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dbe9ee" },
    { media: "(prefers-color-scheme: dark)", color: "#061018" },
  ],
};

/// Applies the saved theme before the first paint, so the screen never flashes the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("hub-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexThai.variable} ${anuphan.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <div className="app-backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
