import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, MailSearch, ShieldAlert, Bell } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate, nf, timeAgo } from '../lib/format'
import { Button, Card, CardHeader, Field, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'

function riskColor(r) {
  return r >= 70 ? 'text-sev-critical' : r >= 45 ? 'text-sev-high' : r > 0 ? 'text-sev-medium' : 'text-emerald-400'
}

function EmailResult({ result, onMonitor }) {
  if (!result) return null
  const clean = result.breach_count === 0
  return (
    <Card className="mt-4">
      <div className="flex flex-col gap-4 border-b border-ink-800 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {clean ? <CheckCircle2 className="h-8 w-8 text-emerald-400" /> : <ShieldAlert className="h-8 w-8 text-sev-critical" />}
          <div>
            <div className="font-mono text-sm text-ink-300">{result.email}</div>
            <div className="text-lg font-semibold text-white">
              {clean ? 'No known breaches' : `Found in ${result.breach_count} breach${result.breach_count === 1 ? '' : 'es'}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-ink-400">Exposure risk</div>
            <div className={clsx('text-2xl font-bold tabular-nums', riskColor(result.risk_score))}>{Math.round(result.risk_score)}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onMonitor(result.email)}><Bell className="h-4 w-4" /> Monitor</Button>
        </div>
      </div>
      {!clean && (
        <div className="p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {result.exposed_data.map((d) => (
              <span key={d} className={clsx('rounded-full px-3 py-1 text-xs ring-1 ring-inset',
                /password|credit|bank|social|auth/i.test(d) ? 'bg-sev-critical/10 text-sev-critical ring-sev-critical/30' : 'bg-ink-800 text-ink-200 ring-ink-700')}>
                {d}
              </span>
            ))}
          </div>
          <ul className="divide-y divide-ink-800">
            {result.breaches.map((b) => (
              <li key={b.name + b.date} className="flex gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-700 bg-ink-950">
                  {b.logo ? <img src={b.logo} alt="" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <MailSearch className="h-4 w-4 text-ink-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-white">{b.name}</span>
                    <span className="font-mono text-xs text-ink-400">{b.date}{b.records ? ` · ${nf.format(b.records)} records` : ''}</span>
                  </div>
                  {b.domain && <div className="text-xs text-ink-400">{b.domain}{b.industry ? ` · ${b.industry}` : ''}</div>}
                  {b.description && <p className="mt-1.5 line-clamp-3 text-sm text-ink-300">{b.description}</p>}
                  {b.data?.length > 0 && <div className="mt-2 text-xs text-ink-400">Exposed: {b.data.join(', ')}</div>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

const STRENGTH_COLORS = ['#ff4d6d', '#ff8a3d', '#f5c84c', '#4cc9f0', '#34d399']

export default function Breach() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [pw, setPw] = useState(null)
  const [pwBusy, setPwBusy] = useState(false)

  useEffect(() => { api('/api/breach/history').then(setHistory).catch(() => {}) }, [])

  async function checkEmail(e) {
    e.preventDefault()
    setEmailBusy(true)
    try {
      const r = await api('/api/breach/email', { method: 'POST', body: { email } })
      setResult(r)
      setHistory((h) => [r, ...h])
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setEmailBusy(false)
    }
  }

  async function checkPassword(e) {
    e.preventDefault()
    setPwBusy(true)
    try {
      setPw(await api('/api/breach/password', { method: 'POST', body: { password } }))
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setPwBusy(false)
    }
  }

  async function monitor(addr) {
    try {
      await api('/api/monitors', { method: 'POST', body: { target_type: 'email', target: addr } })
      toast(`Monitoring ${addr} for new breaches`)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <>
      <PageHeader eyebrow="OSINT" title="Breach intelligence" description="Look up email addresses in public breach datasets and check passwords against hundreds of millions of leaked credentials." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          <Card className="p-5">
            <form onSubmit={checkEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Email address">
                  <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
                </Field>
              </div>
              <Button type="submit" loading={emailBusy}><MailSearch className="h-4 w-4" /> Check breaches</Button>
            </form>
          </Card>
          <EmailResult result={result} onMonitor={monitor} />

          <Card className="mt-6">
            <CardHeader title="Lookup history" />
            {history.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-400">No lookups yet.</p> : (
              <ul className="divide-y divide-ink-800">
                {history.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => setResult(h)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-ink-800/40">
                      <div>
                        <div className="font-mono text-sm text-white">{h.email}</div>
                        <div className="text-xs text-ink-400">{timeAgo(h.checked_at)} · {h.source}</div>
                      </div>
                      <span className={clsx('text-sm font-medium', h.breach_count ? 'text-sev-critical' : 'text-emerald-400')}>
                        {h.breach_count ? `${h.breach_count} breaches` : 'Clean'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <div className="mb-1 flex items-center gap-2 font-semibold text-white"><KeyRound className="h-4 w-4 text-cyan" /> Password exposure check</div>
          <p className="mb-4 text-xs text-ink-400">
            Uses k-anonymity: only the first 5 characters of the password’s SHA-1 hash are sent to Pwned Passwords. The password is never stored.
          </p>
          <form onSubmit={checkPassword} className="space-y-4">
            <div className="relative">
              <input className="input pr-10 font-mono" type={show ? 'text' : 'password'} required value={password} onChange={(e) => { setPassword(e.target.value); setPw(null) }} placeholder="Enter a password" autoComplete="off" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-white" aria-label="Toggle visibility">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" loading={pwBusy} className="w-full"><Lock className="h-4 w-4" /> Check password</Button>
          </form>
          {pw && (
            <div className="mt-5 space-y-3">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= pw.strength ? STRENGTH_COLORS[pw.strength] : '#162a47' }} />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: STRENGTH_COLORS[pw.strength] }}>{pw.strength_label}</span>
                <span className={clsx('text-xs', pw.pwned ? 'text-sev-critical' : 'text-emerald-400')}>
                  {pw.pwned ? `Seen ${nf.format(pw.count)} times in breaches` : 'Not found in known breaches'}
                </span>
              </div>
              {pw.feedback.length > 0 && (
                <ul className="space-y-1.5 text-xs text-ink-300">
                  {pw.feedback.map((f) => <li key={f} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-400" />{f}</li>)}
                </ul>
              )}
            </div>
          )}
          <p className="mt-5 border-t border-ink-800 pt-4 text-[11px] text-ink-500">Last checked {history[0] ? formatDate(history[0].checked_at) : 'never'}</p>
        </Card>
      </div>
    </>
  )
}
