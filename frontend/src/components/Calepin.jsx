import { useState, useMemo } from 'react'

export default function Calepin({ entries, pages, onFlipToEntry }) {
  const [search, setSearch] = useState('')

  const pageMap = useMemo(() => {
    const m = {}
    pages.forEach((p) => { m[p.id] = p.page_number })
    return m
  }, [pages])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return [...entries]
      .filter(
        (e) =>
          e.french_phrase.toLowerCase().includes(q) ||
          e.english_translation?.toLowerCase().includes(q) ||
          e.context_summary?.toLowerCase().includes(q)
      )
      .sort((a, b) => a.french_phrase.localeCompare(b.french_phrase, 'fr'))
  }, [entries, search])

  // Group alphabetically
  const grouped = useMemo(() => {
    const g = {}
    filtered.forEach((e) => {
      const letter = e.french_phrase[0]?.toUpperCase() || '#'
      if (!g[letter]) g[letter] = []
      g[letter].push(e)
    })
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-slate-800">
        <h2 className="font-serif text-2xl text-amber-100 mb-1">Calepin</h2>
        <p className="text-slate-500 text-xs mb-4">{entries.length} entries · alphabetical</p>
        <input
          type="search"
          placeholder="Search vocabulary…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-600"
        />
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {grouped.length === 0 && (
          <p className="text-slate-600 text-sm mt-8">
            {search ? 'No results.' : 'No vocabulary entries yet.'}
          </p>
        )}
        {grouped.map(([letter, group]) => (
          <div key={letter} className="mb-8">
            <div className="text-xs font-medium text-amber-700 uppercase tracking-widest mb-3 border-b border-slate-800 pb-1">
              {letter}
            </div>
            <div className="space-y-5">
              {group.map((entry) => (
                <div key={entry.id} className="group flex gap-6 items-start">
                  <div className="flex-1 min-w-0">
                    <p className="font-serif text-amber-100 text-lg leading-snug">{entry.french_phrase}</p>
                    <p className="text-slate-300 text-sm mt-0.5">{entry.english_translation}</p>
                    {entry.context_summary && (
                      <p className="text-slate-500 text-xs italic mt-0.5">{entry.context_summary}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-slate-700">p. {pageMap[entry.page_id] ?? '?'}</span>
                    <button
                      onClick={() => onFlipToEntry(entry)}
                      className="text-xs text-slate-600 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      View →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
