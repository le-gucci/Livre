import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL

const compressImage = (file, maxWidth = 1500) =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', 0.88)
    }
    img.src = URL.createObjectURL(file)
  })

export default function UploadModal({ book, pages, userId, onComplete, onClose }) {
  const fileRef = useRef()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [title, setTitle] = useState(book?.title || '')
  const [isNewBook, setIsNewBook] = useState(!book)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const upload = async () => {
    if (!file) return
    setLoading(true)
    setStatus('Uploading image…')

    try {
      // 1. Ensure book exists
      let bookId = book?.id
      let bookObj = book

      if (isNewBook || !bookId) {
        const { data: newBook, error: bErr } = await supabase
          .from('books')
          .insert({ user_id: userId, title: title || 'Untitled' })
          .select()
          .single()
        if (bErr) throw bErr
        bookId = newBook.id
        bookObj = newBook
      }

      // 2. Upload image to Supabase Storage
      const ext = file.name.split('.').pop()
      const path = `${userId}/${bookId}/${Date.now()}.${ext}`
      const { error: sErr } = await supabase.storage.from('pages').upload(path, file)
      if (sErr) throw sErr
      const { data: { publicUrl } } = supabase.storage.from('pages').getPublicUrl(path)

      // 3. Save page record
      const pageNumber = pages.length + 1
      const { data: newPage, error: pErr } = await supabase
        .from('pages')
        .insert({ book_id: bookId, page_number: pageNumber, image_url: publicUrl })
        .select()
        .single()
      if (pErr) throw pErr

      // 4. Send to backend for underline detection
      setStatus('Detecting underlines…')
      const compressed = await compressImage(file)
      const form = new FormData()
      form.append('file', compressed, 'page.jpg')
      const res = await fetch(`${BACKEND}/process-image`, { method: 'POST', body: form })
      const { entries: detected } = await res.json()

      // 5. Save detected entries to Supabase
      if (detected.length) {
        setStatus(`Saving ${detected.length} entries…`)
        const rows = detected.map((e) => ({
          page_id: newPage.id,
          user_id: userId,
          french_phrase: e.phrase,
          english_translation: e.translation,
          context_summary: e.summary,
          bbox: e.bbox,
        }))
        await supabase.from('entries').insert(rows)
      }

      setStatus(`Done! Found ${detected.length} underlined phrase${detected.length !== 1 ? 's' : ''}.`)
      setTimeout(() => onComplete(isNewBook ? bookObj : null, newPage, detected), 1200)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-serif text-lg text-amber-100">Upload page</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {isNewBook && (
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">Book title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. L'Étranger"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-600"
              />
            </div>
          )}

          {!isNewBook && book && (
            <p className="text-xs text-slate-500">
              Adding to <span className="text-slate-300">{book.title}</span> · page {pages.length + 1}
              <button onClick={() => setIsNewBook(true)} className="ml-2 text-amber-600 hover:text-amber-400">+ new book</button>
            </p>
          )}

          {/* Image picker — on mobile, 'capture' opens camera */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-amber-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[140px]"
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-48 rounded object-contain" />
            ) : (
              <>
                <svg className="w-10 h-10 text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <p className="text-sm text-slate-500">Tap to take photo or choose file</p>
              </>
            )}
          </div>
          {/* capture="environment" opens rear camera on iOS */}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

          {status && (
            <p className={`text-xs text-center ${status.startsWith('Error') ? 'text-red-400' : 'text-amber-400'}`}>
              {status}
            </p>
          )}

          <button
            onClick={upload}
            disabled={!file || loading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40"
          >
            {loading ? 'Processing…' : 'Upload & scan'}
          </button>
        </div>
      </div>
    </div>
  )
}
