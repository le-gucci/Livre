import { useEffect, useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NavBar from '../components/NavBar'
import BookView from '../components/BookView'
import VocabPanel from '../components/VocabPanel'
import Calepin from '../components/Calepin'
import UploadModal from '../components/UploadModal'
import AnnotationModal from '../components/AnnotationModal'

export default function Reader({ session }) {
  const [books, setBooks] = useState([])
  const [currentBook, setCurrentBook] = useState(null)
  const [pages, setPages] = useState([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [entries, setEntries] = useState([])
  const [highlightEntry, setHighlightEntry] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showAnnotate, setShowAnnotate] = useState(false)
  const [view, setView] = useState('reader') // 'reader' | 'calepin'

  const uid = session.user.id

  const loadBooks = useCallback(async () => {
    const { data } = await supabase.from('books').select('*').order('created_at', { ascending: false })
    setBooks(data || [])
    if (data?.length && !currentBook) setCurrentBook(data[0])
  }, [currentBook])

  const loadPages = useCallback(async () => {
    if (!currentBook) return
    const { data } = await supabase
      .from('pages')
      .select('*')
      .eq('book_id', currentBook.id)
      .order('page_number')
    setPages(data || [])
    setCurrentPageIndex(0)
  }, [currentBook])

  const loadEntries = useCallback(async () => {
    if (!currentBook) return
    const { data } = await supabase
      .from('entries')
      .select('*, pages(page_number)')
      .eq('user_id', uid)
      .in(
        'page_id',
        pages.map((p) => p.id)
      )
      .order('created_at')
    setEntries(data || [])
  }, [currentBook, pages, uid])

  useEffect(() => { loadBooks() }, [])
  useEffect(() => { loadPages() }, [currentBook])
  useEffect(() => { loadEntries() }, [pages])

  const handleFlipToEntry = (entry) => {
    const pageIdx = pages.findIndex((p) => p.id === entry.page_id)
    if (pageIdx !== -1) setCurrentPageIndex(pageIdx)
    setHighlightEntry(entry)
    setView('reader')
    setTimeout(() => setHighlightEntry(null), 5000)
  }

  const handleUploadComplete = async (newBook, newPages, newEntries) => {
    if (newBook) {
      await loadBooks()
      setCurrentBook(newBook)
    } else {
      await loadPages()
    }
    // entries refresh handled after pages load via useEffect chain
    setShowUpload(false)
  }

  const handleAnnotationSave = async (entry) => {
    setEntries((prev) => [...prev, entry])
    setShowAnnotate(false)
  }

  const handleEntryUpdate = async (updated) => {
    await supabase.from('entries').update({
      french_phrase: updated.french_phrase,
      english_translation: updated.english_translation,
      context_summary: updated.context_summary,
    }).eq('id', updated.id)
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  const handleEntryDelete = async (id) => {
    await supabase.from('entries').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const currentPage = pages[currentPageIndex] || null
  const currentPageEntries = entries.filter((e) => e.page_id === currentPage?.id)

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <NavBar
        view={view}
        onViewChange={setView}
        books={books}
        currentBook={currentBook}
        onBookChange={setCurrentBook}
        onUpload={() => setShowUpload(true)}
        onAnnotate={() => setShowAnnotate(true)}
        onSignOut={() => supabase.auth.signOut()}
        currentPage={currentPage}
      />

      <div className="flex flex-1 overflow-hidden">
        {view === 'reader' ? (
          <>
            <BookView
              pages={pages}
              currentPageIndex={currentPageIndex}
              onPageChange={setCurrentPageIndex}
              highlightEntry={highlightEntry}
            />
            <VocabPanel
              entries={currentPageEntries}
              allEntries={entries}
              onFlipToEntry={handleFlipToEntry}
              onEntryUpdate={handleEntryUpdate}
              onEntryDelete={handleEntryDelete}
            />
          </>
        ) : (
          <Calepin
            entries={entries}
            pages={pages}
            onFlipToEntry={handleFlipToEntry}
          />
        )}
      </div>

      {showUpload && (
        <UploadModal
          book={currentBook}
          pages={pages}
          userId={uid}
          onComplete={handleUploadComplete}
          onClose={() => setShowUpload(false)}
        />
      )}

      {showAnnotate && currentPage && (
        <AnnotationModal
          page={currentPage}
          userId={uid}
          onSave={handleAnnotationSave}
          onClose={() => setShowAnnotate(false)}
        />
      )}
    </div>
  )
}
