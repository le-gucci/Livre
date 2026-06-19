import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'magic'
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg('')

    let error
    if (mode === 'magic') {
      ;({ error } = await supabase.auth.signInWithOtp({ email }))
      if (!error) setMsg('Check your email for a magic link.')
    } else if (mode === 'signup') {
      ;({ error } = await supabase.auth.signUp({ email, password }))
      if (!error) setMsg('Account created — check your email to confirm.')
    } else {
      ;({ error } = await supabase.auth.signInWithPassword({ email, password }))
    }

    if (error) setMsg(error.message)
    setLoading(false)
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm px-8 py-10 bg-slate-900 rounded-2xl shadow-2xl">
        <h1 className="font-serif text-3xl text-amber-100 mb-1 text-center">Livre</h1>
        <p className="text-slate-500 text-xs text-center mb-8 tracking-widest uppercase">
          French reading companion
        </p>

        <form onSubmit={handle} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
          />
          {mode !== 'magic' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {loading ? '…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send magic link'}
          </button>
        </form>

        {msg && <p className="mt-4 text-xs text-center text-amber-400">{msg}</p>}

        <div className="mt-6 flex justify-center gap-4 text-xs text-slate-500">
          <button onClick={() => setMode('login')} className={mode === 'login' ? 'text-amber-400' : 'hover:text-slate-300'}>
            Sign in
          </button>
          <span>·</span>
          <button onClick={() => setMode('signup')} className={mode === 'signup' ? 'text-amber-400' : 'hover:text-slate-300'}>
            Sign up
          </button>
          <span>·</span>
          <button onClick={() => setMode('magic')} className={mode === 'magic' ? 'text-amber-400' : 'hover:text-slate-300'}>
            Magic link
          </button>
        </div>
      </div>
    </div>
  )
}
