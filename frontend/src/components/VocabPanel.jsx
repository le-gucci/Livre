import EntryCard from './EntryCard'

export default function VocabPanel({ entries, allEntries, onFlipToEntry, onEntryUpdate, onEntryDelete }) {
  return (
    <div className="w-80 shrink-0 flex flex-col h-full bg-slate-900 border-l border-slate-800">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-500 uppercase tracking-widest">
          Vocabulaire
        </span>
        <span className="text-xs text-slate-600">{entries.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-700 px-6 text-center">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="text-xs">No vocabulary on this page yet.</p>
            <p className="text-xs">Upload a page or use Annotate to add entries.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onViewContext={() => onFlipToEntry(entry)}
              onUpdate={onEntryUpdate}
              onDelete={onEntryDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
