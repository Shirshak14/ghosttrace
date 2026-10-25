import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, Eye, EyeOff, KeyRound, Lock, MailSearch, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate, nf, timeAgo } from '../lib/format'
import { Button, Card, Field, Group, PageHeader, Row } from '../components/ui'
import { useToast } from '../components/Toast'

const RED = '#FF5A52'
const GREEN = '#3DDC84'
const riskColor = (r) => (r >= 70 ? RED : r >= 45 ? '#FFA726' : r > 0 ? '#F2D95C' : GREEN)

function EmailResult({ result, onMonitor }) {
  if (!result) return null
  const clean = result.breach_count === 0
  return (
    <div className="mt-6 space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {clean ? <CheckCircle2 className="h-9 w-9 text-ios-green" /> : <ShieldAlert className="h-9 w-9 text-ios-red" />}
            <div className="min-w-0">
              <div className="truncate font-mono text-footnote text-label-2">{result.email}</div>
              <div className="text-title3 text-label">
                {clean ? 'No known breaches' : `Found in ${result.breach_count} breach${result.breach_count === 1 ? '' : 'es'}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-caption text-label-3">Exposure risk</div>
              <div className="text-title1 tabular-nums" style={{ color: riskColor(result.risk_score) }}>{Math.round(result.risk_score)}</div>
            </div>
            <Button variant="gray" size="sm" onClick={() => onMonitor(result.email)}><Bell className="h-4 w-4" /> Monitor</Button>
          </div>
        </div>
        {!clean && result.exposed_data.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.exposed_data.map((d) => (
              <span
                key={d}
                className={'inline-flex h-7 items-center rounded-full px-3 text-caption ' + (/password|credit|bank|social|auth/i.test(d) ? 'bg-[#2b1513] text-ios-red' : 'bg-[#1e1e1e] text-label-2')}
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </Card>
      {!clean && (
        <Group header="Breaches" inset={70}>
          {result.breaches.map((b) => (
            <div key={b.name + b.date} className="flex gap-3.5 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-black/40">
                {b.logo ? <img src={b.logo} alt="" className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : <MailSearch className="h-4 w-4 text-label-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-headline text-label">{b.name}</span>
                  <span className="font-mono text-caption text-label-3">{b.date}{b.records ? ` · ${nf.format(b.records)} records` : ''}</span>
                </div>
                {b.domain && <div className="text-footnote text-label-3">{b.domain}{b.industry ? ` · ${b.industry}` : ''}</div>}
                {b.description && <p className="mt-1.5 line-clamp-3 text-subhead text-label-2">{b.description}</p>}
                {b.data?.length > 0 && <div className="mt-2 text-footnote text-label-3">Exposed: {b.data.join(', ')}</div>}
              </div>
            </div>
          ))}
        </Group>
      )}
    </div>
  )
}

const STRENGTH_COLORS = ['#FF5A52', '#FFA726', '#F2D95C', '#5CC8FF', '#3DDC84']

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
      <PageHeader title="Breaches" description="Look up email addresses in public breach datasets and check passwords against hundreds of millions of leaked credentials." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div>
          <Card className="p-5">
            <form onSubmit={checkEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Email address" className="flex-1">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
              </Field>
              <Button type="submit" loading={emailBusy} size="lg"><MailSearch className="h-4 w-4" /> Check</Button>
            </form>
          </Card>
          <EmailResult result={result} onMonitor={monitor} />

          <Group className="mt-8" header="Lookup history">
            {history.length === 0 ? <p className="px-5 py-8 text-center text-subhead text-label-3">No lookups yet.</p> : history.map((h) => (
              <Row
                key={h.id}
                onClick={() => setResult(h)}
                title={<span className="font-mono text-callout">{h.email}</span>}
                subtitle={`${timeAgo(h.checked_at)} · ${h.source}`}
                trailing={<span className="text-subhead font-medium" style={{ color: h.breach_count ? RED : GREEN }}>{h.breach_count ? `${h.breach_count} breaches` : 'Clean'}</span>}
                chevron
              />
            ))}
          </Group>
        </div>

        <Card className="h-fit p-5">
          <div className="mb-1 flex items-center gap-2 text-headline text-label"><KeyRound className="h-4 w-4 text-label-2" /> Password check</div>
          <p className="mb-4 text-footnote text-label-3">
            Uses k-anonymity: only the first 5 characters of the password’s SHA-1 hash are sent to Pwned Passwords. The password is never stored.
          </p>
          <form onSubmit={checkPassword} className="space-y-4">
            <div className="relative">
              <input className="input pr-11 font-mono" type={show ? 'text' : 'password'} required value={password} onChange={(e) => { setPassword(e.target.value); setPw(null) }} placeholder="Enter a password" autoComplete="off" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-label-3 hover:text-label" aria-label="Toggle visibility">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="submit" loading={pwBusy} className="w-full"><Lock className="h-4 w-4" /> Check password</Button>
          </form>
          {pw && (
            <div className="mt-5 space-y-3">
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= pw.strength ? STRENGTH_COLORS[pw.strength] : 'rgba(255,255,255,0.12)' }} />
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-subhead font-semibold" style={{ color: STRENGTH_COLORS[pw.strength] }}>{pw.strength_label}</span>
                <span className="text-footnote" style={{ color: pw.pwned ? RED : GREEN }}>
                  {pw.pwned ? `Seen ${nf.format(pw.count)} times in breaches` : 'Not found in known breaches'}
                </span>
              </div>
              {pw.feedback.length > 0 && (
                <ul className="space-y-1.5 text-footnote text-label-2">
                  {pw.feedback.map((f) => <li key={f} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/50" />{f}</li>)}
                </ul>
              )}
            </div>
          )}
          <p className="mt-5 hairline-t pt-4 text-caption text-label-3">Last checked {history[0] ? formatDate(history[0].checked_at) : 'never'}</p>
        </Card>
      </div>
    </>
  )
}
