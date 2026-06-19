import { useState } from 'react'

export default function EntryCard({ entry, onViewContext, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    french_phrase: entry.french_phrase,
    english_translation: entry.english_translation,
    context_summary: entry.context_summary,
  })

  const save = () => {
    onUpdate({ ...entry, ...draft })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border-b border-slate-800 px-4 py-4 space-y-2">
        <textarea
          value={draft.french_phrase}
          onChange={(e) => setDraft((d) => ({ ...d, french_phrase: e.target.value }))}
          rows={2}
          className="w-full bg-slate-800 text-amber-100 font-serif text-sm rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
        <textarea
          value={draft.english_translation}
          onChange={(e) => setDraft((d) => ({ ...d, english_translation: e.target.value }))}
          rows={2}
          className="w-full bg-slate-800 text-slate-300 text-sm rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
        <textarea
          value={draft.context_summary}
          onChange={(e) => setDraft((d) => ({ ...d, context_summary: e.target.value }))}
          rows={2}
          placeholder="Context note…"
          className="w-full bg-slate-800 text-slate-500 text-xs italic rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600"
        />
        <div className="flex gap-2">
          <button onClick={save} className="text-xs bg-amber-600 hover:bg-amber-500 text-white rounded px-3 py-1 transition-colors">Save</button>
          <button onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-800/60 px-4 py-4 group hover:bg-slate-800/30 transition-colors">
      {/* French phrase */}
      <p className="font-serif text-amber-100 text-base leading-snug mb-1.5">
        {entry.french_phrase}
      </p>

      {/* English translation */}
      <p className="text-slate-300 text-sm leading-snug mb-1">
        {entry.english_translation || <span className="italic text-slate-600">No translation</span>}
      </p>

      {/* Context summary */}
      {entry.context_summary && (
        <p className="text-slate-500 text-xs italic leading-snug">
          {entry.context_summary}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onViewContext}
          title="Flip to page"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          View
        </button>
        <button
          onClick={() => setEditing(true)}
          title="Edit entry"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Edit
        </button>
        <button
          onClick={() => { if (confirm('Delete this entry?')) onDelete(entry.id) }}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-red-400 transition-colors ml-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Delete
        </button>
      </div>
    </div>
  )
}
