// Server-rendered word cloud of trails. Font size scales with ride frequency.
// `trails` is expected to be [{ id, name, count, fastestSec, ... }] sorted by count desc.

export default function TrailCloud({ trails }) {
  if (!trails || trails.length === 0) {
    return <p className="text-[var(--muted)] text-sm">No trails ridden yet.</p>;
  }

  const maxCount = Math.max(...trails.map((t) => t.count || 1));
  const minCount = Math.min(...trails.map((t) => t.count || 1));

  // Map count → font size in px.
  function sizeFor(count) {
    if (maxCount === minCount) return 18;
    const t = (count - minCount) / (maxCount - minCount);
    return Math.round(13 + t * 18); // 13px → 31px
  }

  // Alternate accent colors for visual rhythm.
  const palette = ["var(--accent)", "var(--accent3)", "#4fa05f", "#e0a040", "#9b59b6"];

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 items-baseline">
      {trails.map((t, i) => {
        const fs = sizeFor(t.count || 1);
        const color = t.count >= Math.ceil(maxCount * 0.66)
          ? "var(--accent)"
          : t.count >= Math.ceil(maxCount * 0.33)
          ? "var(--accent3)"
          : "var(--muted)";
        return (
          <a
            key={t.id}
            href={`/trails/${t.id}`}
            title={`${t.count} ride${t.count === 1 ? "" : "s"}${t.fastestSec ? ` · best ${Math.floor(t.fastestSec / 60)}:${String(t.fastestSec % 60).padStart(2, "0")}` : ""}`}
            style={{
              fontSize: `${fs}px`,
              color,
              fontWeight: fs >= 22 ? 800 : 600,
              lineHeight: 1.15,
            }}
            className="hover:opacity-70 hover:underline cursor-pointer"
          >
            {t.name}
          </a>
        );
      })}
    </div>
  );
}
