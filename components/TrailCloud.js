// Server-rendered word cloud of trails. Top 20 by ride count, with a peach→teal
// gradient on every word so they pop without monochrome flatness.
// `trails` is expected to be [{ id, name, count, fastestSec, ... }] sorted by count desc.

const MAX_WORDS = 20;

export default function TrailCloud({ trails }) {
  if (!trails || trails.length === 0) {
    return <p className="text-[var(--muted)] text-sm">No trails ridden yet.</p>;
  }

  const top = trails.slice(0, MAX_WORDS);
  const maxCount = Math.max(...top.map((t) => t.count || 1));
  const minCount = Math.min(...top.map((t) => t.count || 1));

  // Map count → font size in px.
  function sizeFor(count) {
    if (maxCount === minCount) return 22;
    const t = (count - minCount) / (maxCount - minCount);
    return Math.round(14 + t * 22); // 14px → 36px
  }

  // Two gradient palettes: hottest trails get the warm peach→accent gradient,
  // colder ones get a cooler teal→muted blend. Keeps the cloud on-brand
  // without being a monochrome blob.
  function gradientFor(count) {
    const tier = count / maxCount;
    if (tier >= 0.66) return "linear-gradient(135deg, #fccabb 0%, #f8b6a6 50%, #d68070 100%)"; // warm peach
    if (tier >= 0.33) return "linear-gradient(135deg, #f8b6a6 0%, #f0ad4e 100%)";               // peach → amber
    return                  "linear-gradient(135deg, #a7bcc4 0%, #5fa7c4 100%)";                // muted → teal
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 items-baseline">
      {top.map((t) => {
        const fs = sizeFor(t.count || 1);
        const bg = gradientFor(t.count || 1);
        return (
          <a
            key={t.id}
            href={`/trails/${t.id}`}
            title={`${t.count} ride${t.count === 1 ? "" : "s"}${t.fastestSec ? ` · best ${Math.floor(t.fastestSec / 60)}:${String(t.fastestSec % 60).padStart(2, "0")}` : ""}`}
            style={{
              fontSize: `${fs}px`,
              fontWeight: fs >= 24 ? 800 : 700,
              lineHeight: 1.15,
              backgroundImage: bg,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              WebkitTextFillColor: "transparent",
              transition: "transform 0.15s ease, opacity 0.15s ease",
            }}
            className="hover:opacity-80 hover:scale-105 cursor-pointer inline-block"
          >
            {t.name}
          </a>
        );
      })}
      {trails.length > MAX_WORDS && (
        <span className="text-xs text-[var(--muted)] self-baseline ml-1">
          +{trails.length - MAX_WORDS} more
        </span>
      )}
    </div>
  );
}
