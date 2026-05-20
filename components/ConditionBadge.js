// Small visual badge showing latest condition for a trail.

const STATUS_STYLE = {
  dry:    { label: "Dry",    bg: "rgba(240,173,78,0.18)",  color: "#f0ad4e", border: "rgba(240,173,78,0.6)" },
  tacky:  { label: "Tacky",  bg: "rgba(92,184,92,0.18)",   color: "#5cb85c", border: "rgba(92,184,92,0.6)" },
  wet:    { label: "Wet",    bg: "rgba(95,167,196,0.18)",  color: "#5fa7c4", border: "rgba(95,167,196,0.6)" },
  muddy:  { label: "Muddy",  bg: "rgba(166,131,84,0.20)",  color: "#a68354", border: "rgba(166,131,84,0.6)" },
  snow:   { label: "Snow",   bg: "rgba(220,235,245,0.25)", color: "#cfe3ee", border: "rgba(220,235,245,0.5)" },
  closed: { label: "Closed", bg: "rgba(217,83,79,0.18)",   color: "#d9534f", border: "rgba(217,83,79,0.6)" },
};

export default function ConditionBadge({ status, daysAgo, title }) {
  const style = STATUS_STYLE[status];
  if (!style) return null;
  return (
    <span
      title={title || ""}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {style.label}{daysAgo != null && ` · ${daysAgo}d`}
    </span>
  );
}
