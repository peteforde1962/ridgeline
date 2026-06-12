// Single source of truth for the RidgeLine wordmark icon.
// Used in PageHeader, Sidebar, marketing landing, auth pages, dashboard, etc.
//
// Design:
//   - Two-layer mountain silhouette (background ridge in lighter peach,
//     dominant foreground peak in deep charcoal) for depth
//   - Snow cap accent on the tallest peak in warm off-white
//   - Container has a top-edge sheen sliver + a soft radial peach gradient
//     for a "lit-from-above" feel instead of the old flat linear gradient

export default function LogoMark({ size = 32, className = "" }) {
  // Inner SVG draws at ~58% of the container so it doesn't crowd the edges.
  const inner = Math.round(size * 0.58);
  const radius = Math.round(size * 0.30);

  return (
    <span
      className={`logo-mark ${className}`.trim()}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <svg
        viewBox="0 0 24 24"
        width={inner} height={inner}
        fill="none" xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        {/* Background ridge — lighter, softer hills behind the main peak */}
        <path
          d="M1 20 L5 15 L8 17 L13 12 L17 15 L23 20 Z"
          fill="rgba(255, 255, 255, 0.35)"
        />
        {/* Foreground peak — bold dark mountain */}
        <path
          d="M3 20 L10 8 L13 12 L17 4 L21 20 Z"
          fill="#1a2a30"
        />
        {/* Snow cap on the tall peak */}
        <path
          d="M16 6 L17 4 L18 6.5 L17 6 Z"
          fill="#f4eee4"
        />
      </svg>
    </span>
  );
}
