import { useRef, useState, useEffect } from 'react'

export default function BookView({ pages, currentPageIndex, onPageChange, highlightEntry }) {
  const imgRef = useRef(null)
  const [imgRect, setImgRect] = useState(null)

  const page = pages[currentPageIndex]

  const updateRect = () => {
    if (imgRef.current) {
      const r = imgRef.current.getBoundingClientRect()
      const parent = imgRef.current.parentElement.getBoundingClientRect()
      setImgRect({
        left: r.left - parent.left,
        top: r.top - parent.top,
        width: r.width,
        height: r.height,
      })
    }
  }

  useEffect(() => {
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [])

  const bbox = highlightEntry?.bbox && imgRect ? {
    left: imgRect.left + highlightEntry.bbox.x * imgRect.width,
    top: imgRect.top + highlightEntry.bbox.y * imgRect.height,
    width: highlightEntry.bbox.w * imgRect.width,
    height: highlightEntry.bbox.h * imgRect.height,
  } : null

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-950 min-w-0">
      {/* Page image area */}
      <div className="relative flex-1 flex items-end justify-start overflow-hidden p-6 pb-4">
        {page ? (
          <>
            <img
              ref={imgRef}
              src={page.image_url}
              alt={`Page ${page.page_number}`}
              onLoad={updateRect}
              className="max-h-full max-w-full object-contain rounded-lg shadow-2xl shadow-black/60 border border-slate-800"
              style={{ maxHeight: 'calc(100% - 1rem)' }}
            />
            {bbox && (
              <div
                className="absolute pointer-events-none rounded highlight-pulse"
                style={{
                  left: bbox.left,
                  top: bbox.top,
                  width: bbox.width,
                  height: bbox.height,
                  border: '2px solid rgba(251,191,36,0.8)',
                  backgroundColor: 'rgba(251,191,36,0.2)',
                }}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-700 gap-3">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <p className="text-sm">Upload pages to begin reading</p>
          </div>
        )}
      </div>

      {/* Page thumbnail strip */}
      {pages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-6 py-3 bg-slate-900/60 border-t border-slate-800 shrink-0">
          {pages.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onPageChange(i)}
              className={`shrink-0 w-12 h-16 rounded overflow-hidden border-2 transition-colors ${
                i === currentPageIndex ? 'border-amber-500' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
