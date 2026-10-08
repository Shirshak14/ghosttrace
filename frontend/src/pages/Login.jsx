import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { Button, Field } from '../components/ui'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(location.state?.from || '/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your GhostTrace workspace."
      footer={<>New to GhostTrace? <Link to="/register" className="font-medium text-cyan hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <div className="rounded-lg border border-sev-critical/30 bg-sev-critical/10 px-3 py-2 text-sm text-sev-critical">{error}</div>}
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
      </form>
    </AuthLayout>
  )
}
