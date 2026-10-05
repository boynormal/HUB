type IconName =
  | "home"
  | "check"
  | "folder"
  | "bell"
  | "chart"
  | "settings"
  | "plus"
  | "user"
  | "search"
  | "eye"
  | "message"
  | "paperclip"
  | "pin"
  | "sun"
  | "moon"
  | "book";

/// One stroke set so navigation, cards, and the theme control look like the same product.
export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.2 2.3 2.3 4.7-5" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <path d="M7 16V10" />
          <path d="M12 16V6" />
          <path d="M17 16v-4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.8l1.6 1.6M17.6 15.6l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.2l1.6-1.6M17.6 8.4l1.6-1.6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 6v12M6 12h12" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3" />
          <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 3.5 3.5" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M5 6.5h14v9H8l-3 2.5z" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...common}>
          <path d="m15 8-5.5 5.5a2 2 0 0 1-3-2.8L12 5.2a3.2 3.2 0 0 1 4.5 4.5L10 16.2a4.2 4.2 0 0 1-6-6" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M9 4.5h6l-1 5 3 2v1.5H7V11.5l3-2z" />
          <path d="M12 13v6.5" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 3.5v2M12 18.5v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M3.5 12h2M18.5 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M16 3.5A8 8 0 1 0 20.5 14 6.2 6.2 0 0 1 16 3.5z" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M5 5.5h8.5A2.5 2.5 0 0 1 16 8v11H7.5A2.5 2.5 0 0 0 5 16.5z" />
          <path d="M5 5.5v11" />
          <path d="M16 8h2.5A1.5 1.5 0 0 1 20 9.5V19h-4" />
        </svg>
      );
  }
}
