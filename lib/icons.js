// Shared stroke-style SVG icons. Match the sidebar look.
// Usage: <Icon name="target" size={16} />

const PATHS = {
  home:    <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 21V14h6v7" /></>,
  target:  <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  heart:   <path d="M12 21s-7-4.35-9-9.7C1.7 7 4.4 4 7.7 4c2 0 3.4 1.1 4.3 2.6C12.9 5.1 14.3 4 16.3 4 19.6 4 22.3 7 21 11.3 19 16.65 12 21 12 21z" />,
  bike:    <><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4-9h4l3 6" /><path d="M9 8h3" /></>,
  bolt:    <path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />,
  bars:    <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  dumb:    <><path d="M6 8v8M3 11v2M21 11v2M18 8v8M6 12h12" /></>,
  yoga:    <><circle cx="12" cy="5" r="2" /><path d="M12 8v4M8 12h8M9 22l3-10 3 10M4 12l-2 6M20 12l2 6" /></>,
  run:     <><circle cx="14" cy="4" r="2" /><path d="M9 20l3-7-3-3 4-3 3 3h3M10 11l-3 4-2-1" /></>,
  rope:    <><path d="M5 5c4 2 4 6 0 8s-4 6 0 8" /><path d="M19 5c-4 2-4 6 0 8s4 6 0 8" /></>,
  movie:   <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20M7 6V4M17 6V4" /></>,
  cog:     <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2" /></>,
  moon:    <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />,
  globe:   <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>,
  chat:    <path d="M21 11.5a8.4 8.4 0 01-1.5 4.8c-1 1.5-2.7 2.7-4.7 3.4l-3 1.3.6-3.4A8.4 8.4 0 013 11.5C3 7 7 3 12 3s9 4 9 8.5z" />,
  plus:    <><path d="M12 5v14M5 12h14" /></>,
  send:    <><path d="M21 3L3 11l8 3 3 8 7-19z" /><path d="M11 14l4-4" /></>,
  chart:   <><path d="M3 3v18h18" /><path d="M7 14l4-5 4 3 5-7" /></>,
  whistle: <><circle cx="9" cy="13" r="6" /><path d="M15 13h6M18 10v6" /></>,
  more:    <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
};

export default function Icon({ name, size = 18, stroke = "currentColor", className = "" }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size} height={size}
      fill="none" stroke={stroke}
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {path}
    </svg>
  );
}
