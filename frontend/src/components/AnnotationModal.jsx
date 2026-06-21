import { useRef, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL

export default function AnnotationModal({ page, userId, onSave, onClose }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [selection, setSelection] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [startPt, setStartPt] = useState(null)
  const [ocrText, setOcrText] = useState('')
  const [translation, setTranslation] = useState('')
  const [summary, setSummary] = useState('')
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (selection) {
      const { x1, y1, x2, y2 } = selection
      ctx.strokeStyle = 'rgba(251,191,36,0.9)'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      ctx.fillStyle = 'rgba(251,191,36,0.12)'
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    }
  }, [imgLoaded, selection])

  useEffect(() => { draw() }, [draw])

  const canvasCoords = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const cropBlob = (canvas, cx, cy, cw, ch) =>
    new Promise((res) => {
      const c = document.createElement('canvas')
      c.width = cw
      c.height = ch
      c.getContext('2d').drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
      c.toBlob(res, 'image/jpeg', 0.9)
    })

  const ocrBlob = async (blob) => {
    const form = new FormData()
    form.append('file', blob, 'crop.jpg')
    const res = await fetch(`${BACKEND}/ocr-crop`, { method: 'POST', body: form })
    const { text } = await res.json()
    return text || ''
  }

  const onDown = (e) => {
    e.preventDefault()
    const pt = canvasCoords(e)
    setDragging(true)
    setStartPt(pt)
    setSelection({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y })
  }

  const onMove = (e) => {
    if (!dragging) return
    e.preventDefault()
    setSelection({ x1: startPt.x, y1: startPt.y, ...canvasCoords(e), x2: canvasCoords(e).x, y2: canvasCoords(e).y })
  }

  const onUp = async (e) => {
    if (!dragging) return
    e.preventDefault()
    setDragging(false)
    if (!selection) return
    const { x1, y1, x2, y2 } = selection
    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) return

    setLoading(true)
    setStatus('Reading text…')
    try {
      const canvas = canvasRef.current
      const sx = Math.min(x1, x2), sy = Math.min(y1, y2)
      const sw = Math.abs(x2 - x1), sh = Math.abs(y2 - y1)

      // OCR the exact phrase selection
      const phraseBlob = await cropBlob(canvas, sx, sy, sw, sh)
      const text = await ocrBlob(phraseBlob)
      setOcrText(text)

      // OCR a wider region for surrounding sentence context
      const ctxY1 = Math.max(0, sy - sh * 3)
      const ctxY2 = Math.min(canvas.height, sy + sh + sh * 2)
      const contextBlob = await cropBlob(canvas, 0, ctxY1, canvas.width, ctxY2 - ctxY1)
      const contextText = await ocrBlob(contextBlob)

      setStatus('Translating…')
      const res = await fetch(`${BACKEND}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context: contextText, with_summary: true }),
      })
      const { translation: t, summary: s } = await res.json()
      setTranslation(t)
      setSummary(s)
      setStep('confirm')
      setStatus('')
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    }
    setLoading(false)
  }

  const save = async () => {
    if (!ocrText) return
    setLoading(true)
    setStatus('')
    try {
      const canvas = canvasRef.current
      const { x1, y1, x2, y2 } = selection
      const bbox = {
        x: Math.min(x1, x2) / canvas.width,
        y: Math.min(y1, y2) / canvas.height,
        w: Math.abs(x2 - x1) / canvas.width,
        h: Math.abs(y2 - y1) / canvas.height,
      }
      const { data, error } = await supabase
        .from('entries')
        .insert({
          page_id: page.id,
          user_id: userId,
          french_phrase: ocrText,
          english_translation: translation,
          context_summary: summary,
          bbox,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      onSave(data)
    } catch (err) {
      setStatus(`Error: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <h2 className="font-serif text-amber-100 text-base">
          {step === 'select' ? 'Draw a box around the phrase' : 'Confirm entry'}
        </h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Cancel</button>
      </div>

      {step === 'select' ? (
        <div className="flex-1 overflow-auto flex items-start justify-center p-2 relative">
          <img
            ref={imgRef}
            src={page.image_url}
            crossOrigin="anonymous"
            alt=""
            onLoad={(e) => {
              const canvas = canvasRef.current
              canvas.width = e.target.naturalWidth
              canvas.height = e.target.naturalHeight
              setImgLoaded(true)
            }}
            className="hidden"
          />
          <canvas
            ref={canvasRef}
            className="max-w-full cursor-crosshair touch-none"
            style={{ maxHeight: 'calc(100vh - 120px)' }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          />
          {(status || loading) && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-amber-400 bg-slate-900/90 px-3 py-1.5 rounded-full">
              {status || 'Processing…'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">French phrase</label>
              <textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-amber-100 font-serif rounded-lg px-3 py-2 text-base focus:outline-none focus:border-amber-600 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">English translation</label>
              <textarea
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-600 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">
                Context note
                <span className="ml-2 normal-case text-slate-600 font-normal">AI · editable</span>
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-xs italic focus:outline-none focus:border-amber-600 resize-none"
              />
            </div>
            {status && (
              <p className="text-xs text-red-400">{status}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={!ocrText || loading}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40"
              >
                {loading ? 'Saving…' : 'Save entry'}
              </button>
              <button
                onClick={() => { setStep('select'); setStatus('') }}
                className="px-4 text-sm text-slate-500 hover:text-slate-300"
              >
                ← Redo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
