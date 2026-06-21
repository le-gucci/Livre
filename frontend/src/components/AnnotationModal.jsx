import { useRef, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const BACKEND = import.meta.env.VITE_BACKEND_URL

export default function AnnotationModal({ page, userId, onSave, onClose }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const selRef = useRef(null)   // always holds latest selection synchronously
  const startRef = useRef(null)
  const draggingRef = useRef(false)
  const [selection, setSelection] = useState(null) // drives visual redraw only
  const [ocrText, setOcrText] = useState('')
  const [translation, setTranslation] = useState('')
  const [summary, setSummary] = useState('')
  const [step, setStep] = useState('select')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const syncCanvasSize = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return
    canvas.width = img.clientWidth
    canvas.height = img.clientHeight
  }

  useEffect(() => {
    window.addEventListener('resize', syncCanvasSize)
    return () => window.removeEventListener('resize', syncCanvasSize)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const sel = selRef.current
    if (sel) {
      const { x1, y1, x2, y2 } = sel
      ctx.strokeStyle = 'rgba(251,191,36,0.9)'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
      ctx.fillStyle = 'rgba(251,191,36,0.12)'
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    }
  }, [selection])

  useEffect(() => { draw() }, [draw])

  const pt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const onDown = (e) => {
    e.preventDefault()
    const p = pt(e)
    draggingRef.current = true
    startRef.current = p
    const sel = { x1: p.x, y1: p.y, x2: p.x, y2: p.y }
    selRef.current = sel
    setSelection({ ...sel })
  }

  const onMove = (e) => {
    if (!draggingRef.current) return
    e.preventDefault()
    const p = pt(e)
    const sel = { x1: startRef.current.x, y1: startRef.current.y, x2: p.x, y2: p.y }
    selRef.current = sel
    setSelection({ ...sel })
  }

  const onUp = async (e) => {
    if (!draggingRef.current) return
    e.preventDefault()
    draggingRef.current = false

    const sel = selRef.current
    if (!sel) return
    const { x1, y1, x2, y2 } = sel
    if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) return

    setLoading(true)
    setStatus('Reading text…')
    try {
      const canvas = canvasRef.current
      const nx = Math.min(x1, x2) / canvas.width
      const ny = Math.min(y1, y2) / canvas.height
      const nw = Math.abs(x2 - x1) / canvas.width
      const nh = Math.abs(y2 - y1) / canvas.height

      // Backend fetches the image and crops it server-side — no canvas taint issue
      const ocrRes = await fetch(`${BACKEND}/ocr-region`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: page.image_url, x: nx, y: ny, w: nw, h: nh }),
      })
      const { text, context } = await ocrRes.json()
      setOcrText(text)

      setStatus('Translating…')
      const transRes = await fetch(`${BACKEND}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context, with_summary: true }),
      })
      const { translation: t, summary: s } = await transRes.json()
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
      const { x1, y1, x2, y2 } = selRef.current
      const bbox = {
        x: Math.min(x1, x2) / canvas.width,
        y: Math.min(y1, y2) / canvas.height,
        w: Math.abs(x2 - x1) / canvas.width,
        h: Math.abs(y2 - y1) / canvas.height,
      }
      const { data, error } = await supabase
        .from('entries')
        .insert({ page_id: page.id, user_id: userId, french_phrase: ocrText, english_translation: translation, context_summary: summary, bbox })
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
        <div className="flex-1 overflow-auto flex items-start justify-center p-2">
          <div className="relative inline-block">
            <img
              ref={imgRef}
              src={page.image_url}
              alt=""
              onLoad={syncCanvasSize}
              draggable={false}
              className="max-w-full select-none block"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            />
            {/* Canvas overlay only draws the selection rect — never holds image pixels, never tainted */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-crosshair touch-none"
              style={{ width: '100%', height: '100%' }}
              onMouseDown={onDown}
              onMouseMove={onMove}
              onMouseUp={onUp}
              onTouchStart={onDown}
              onTouchMove={onMove}
              onTouchEnd={onUp}
            />
            {(status || loading) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-amber-400 bg-slate-900/90 px-3 py-1.5 rounded-full whitespace-nowrap pointer-events-none">
                {status || 'Processing…'}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">French phrase</label>
              <textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-amber-100 font-serif rounded-lg px-3 py-2 text-base focus:outline-none focus:border-amber-600 resize-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">English translation</label>
              <textarea value={translation} onChange={(e) => setTranslation(e.target.value)} rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-600 resize-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-widest block mb-1">
                Context note <span className="ml-1 normal-case text-slate-600 font-normal">AI · editable</span>
              </label>
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3}
                className="w-full bg-slate-800 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-xs italic focus:outline-none focus:border-amber-600 resize-none" />
            </div>
            {status && <p className="text-xs text-red-400">{status}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={!ocrText || loading}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40">
                {loading ? 'Saving…' : 'Save entry'}
              </button>
              <button onClick={() => { setStep('select'); setStatus('') }}
                className="px-4 text-sm text-slate-500 hover:text-slate-300">
                ← Redo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
