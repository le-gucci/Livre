import { useState } from 'react'

export default function NavBar({
  view,
  onViewChange,
  books,
  currentBook,
  onBookChange,
  onUpload,
  onAnnotate,
  onSignOut,
  currentPage,
}) {
  const [bookMenuOpen, setBookMenuOpen] = useState(false)

  return (
    <nav className="flex items-center gap-3 px-4 h-12 bg-slate-900 border-b border-slate-800 shrink-0 z-10">
      {/* Brand */}
      <span className="font-serif text-amber-200 text-lg font-medium mr-2">Livre</span>

      {/* View toggle */}
      <div className="flex bg-slate-800 rounded-md p-0.5 text-xs">
        {['reader', 'calepin'].map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1 rounded capitalize transition-colors ${
              view === v ? 'bg-slate-600 text-slate-100' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Book selector */}
      <div className="relative">
        <button
          onClick={() => setBookMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-1"
        >
          <span className="max-w-[120px] truncate">{currentBook?.title || 'No book'}</span>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {bookMenuOpen && (
          <div className="absolute top-8 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[160px] z-50">
            {books.map((b) => (
              <button
                key={b.id}
                onClick={() => { onBookChange(b); setBookMenuOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg truncate"
              >
                {b.title}
              </button>
            ))}
            {!books.length && (
              <div className="px-3 py-2 text-xs text-slate-500">No books yet</div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      {currentPage && view === 'reader' && (
        <button
          onClick={onAnnotate}
          title="Add annotation manually"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" /></svg>
          Annotate
        </button>
      )}

      <button
        onClick={onUpload}
        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-md px-3 py-1.5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Upload
      </button>

      <button
        onClick={onSignOut}
        title="Sign out"
        className="text-slate-600 hover:text-slate-400 transition-colors ml-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" /></svg>
      </button>
    </nav>
  )
}
