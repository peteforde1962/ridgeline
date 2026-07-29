// Small on-brand peach unread badge. Renders nothing when count is 0/undefined.
// Two size presets — "sm" for sidebar/nav rows, "md" for card corners.

export default function UnreadBadge({ count, size = "sm" }) {
  if (!count || count < 1) return null;
  const dim = size === "md" ? 22 : 18;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-extrabold"
      style={{
        minWidth: dim,
        height: dim,
        padding: "0 6px",
        fontSize: size === "md" ? 12 : 11,
        lineHeight: 1,
        background: "linear-gradient(135deg, var(--accent), var(--accent2,#fccabb))",
        color: "#1a2a30",
        boxShadow: "0 2px 6px rgba(242,104,56,0.35)",
      }}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
