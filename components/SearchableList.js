"use client";

// Generic searchable list used by Strength / Yoga / Run / Rope pages.
// Accepts a flat list of items and a search-key function to filter on.

import { useState, useMemo } from "react";

export default function SearchableList({ items, getSearchText, renderItem, placeholder = "Search…", groupBy = null }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(q));
  }, [items, getSearchText, query]);

  const groups = useMemo(() => {
    if (!groupBy) return null;
    const out = {};
    for (const item of filtered) {
      const key = groupBy(item) || "Other";
      out[key] = out[key] || [];
      out[key].push(item);
    }
    return out;
  }, [filtered, groupBy]);

  return (
    <>
      <div className="mb-4 relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
        <div className="text-xs text-[var(--muted)] mt-2">
          {filtered.length} of {items.length} match{filtered.length === 1 ? "" : "es"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-[var(--muted)]">No matches.</div>
      ) : groups ? (
        <div className="space-y-6">
          {Object.entries(groups).map(([groupName, groupItems]) => (
            <section key={groupName}>
              <h3 className="text-sm font-bold mb-2 text-[var(--muted)] uppercase tracking-wide">{groupName}</h3>
              <div className="space-y-2">
                {groupItems.map((item, i) => renderItem(item, i))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => renderItem(item, i))}
        </div>
      )}
    </>
  );
}
