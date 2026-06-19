import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../hooks/useAdminAuth'

export default function AdminLogin() {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value && index < 3) {
      document.getElementById(`pin-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`pin-${index - 1}`)?.focus()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const pin = digits.join('')
    if (pin.length !== 4) {
      setError('Enter all 4 digits.')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await login(pin)
    setSubmitting(false)
    if (result.success) {
      navigate('/admin')
    } else {
      setError(result.error)
      setDigits(['', '', '', ''])
      document.getElementById('pin-0')?.focus()
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold">Admin Login</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the 4-digit admin PIN to continue.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-3" role="group" aria-label="4 digit PIN">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`pin-${i}`}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
              className="h-14 w-12 rounded-xl border border-slate-300 text-center text-2xl font-semibold focus-visible:border-indigo-500 dark:border-slate-700 dark:bg-slate-900"
            />
          ))}
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
