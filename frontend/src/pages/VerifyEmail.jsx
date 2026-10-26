import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { user, setUser } = useAuth()
  const [state, setState] = useState(token ? 'working' : 'missing')
  const [error, setError] = useState('')
  const sent = useRef(false)

  useEffect(() => {
    // Strict mode runs effects twice in development; the link only needs confirming once.
    if (!token || sent.current) return
    sent.current = true
    api('/api/auth/verify-email', { method: 'POST', body: { token } })
      .then((verified) => {
        setState('done')
        if (user && user.id === verified.id) setUser(verified)
      })
      .catch((err) => { setError(err.message); setState('failed') })
  }, [token, user, setUser])

  const next = user ? '/app' : '/login'
  return (
    <AuthLayout
      title="Confirm your email"
      subtitle="So GhostTrace can email you when it finds a leak."
      footer={<Link to={next} className="font-medium text-tint-light hover:underline">{user ? 'Go to dashboard' : 'Back to sign in'}</Link>}
    >
      {state === 'working' && <div className="text-subhead text-label-2">Confirming…</div>}
      {state === 'done' && (
        <div className="rounded-3xl bg-[#3DDC84]/15 px-4 py-3 text-subhead text-[#3DDC84]">Your email is confirmed. Leak alerts are on.</div>
      )}
      {(state === 'failed' || state === 'missing') && (
        <div className="rounded-3xl bg-ios-red/15 px-4 py-3 text-subhead text-ios-red">
          {state === 'missing' ? 'This confirmation link is incomplete.' : error}{' '}
          {user ? 'You can send a new link from the banner on your dashboard.' : 'Sign in to send a new link.'}
        </div>
      )}
    </AuthLayout>
  )
}
