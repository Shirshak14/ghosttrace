import { useEffect, useState } from 'react'
import { ExternalLink, GitCommit, X, CheckCircle2, Ban, RotateCcw, Copy } from 'lucide-react'
import { Button, RiskMeter, SeverityBadge, StatusBadge } from './ui'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useToast } from './Toast'

const REMEDIATION = {
  aws: 'Deactivate the key in AWS IAM, create a new one, and review CloudTrail for activity from the leaked key.',
  cloud: 'Revoke the credential in your cloud console, issue a new one, and audit recent API activity.',
  api_key: 'Regenerate the key in the provider dashboard and update it wherever it is used. Check billing and usage logs.',
  token: 'Revoke the token immediately and issue a new one with the narrowest scope possible.',
  jwt: 'Rotate the signing secret if this token is long-lived, and invalidate active sessions.',
  private_key: 'Treat the key pair as compromised: remove the public key from every server and account, then generate a new pair.',
  database: 'Change the database password, restrict network access to the database, and review connection logs.',
  password: 'Change this password everywhere it is used and move it into a secrets manager or environment variable.',
  email: 'Check this address in Breach Intel and consider whether it should be public.',
  webhook: 'Regenerate the webhook URL so the leaked one stops accepting messages.',
}

export default function FindingDrawer({ finding, onClose, onChange }) {
  const toast = useToast()
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!finding) return null
  const f = finding

  async function setStatus(status) {
    setSaving(status)
    try {
      const updated = await api(`/api/findings/${f.id}`, { method: 'PATCH', body: { status } })
      onChange?.(updated)
      toast(status === 'open' ? 'Finding reopened' : status === 'resolved' ? 'Marked as resolved' : 'Marked as false positive')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  const location = `${f.repository ? f.repository + '/' : ''}${f.file_path || ''}${f.line_number ? ':' + f.line_number : ''}`

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-ink-700 bg-ink-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink-800 px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={f.severity} />
              <StatusBadge status={f.status} />
              {f.in_history_only && <span className="rounded-md bg-signal/15 px-2 py-0.5 text-[11px] text-signal ring-1 ring-inset ring-signal/30">git history</span>}
            </div>
            <h2 className="text-lg font-semibold text-white">{f.credential_type}</h2>
            <p className="mt-1 break-all font-mono text-xs text-ink-300">{location}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">Risk score</div>
              <div className="mt-1 text-2xl font-bold text-white">{Math.round(f.risk_score)}</div>
            </div>
            <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">AI confidence</div>
              <div className="mt-1 text-2xl font-bold text-white">{Math.round(f.confidence * 100)}%</div>
            </div>
            <div className="rounded-lg border border-ink-800 bg-ink-950/50 p-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">Entropy</div>
              <div className="mt-1 text-2xl font-bold text-white">{f.entropy.toFixed(1)}</div>
            </div>
          </div>

          <section>
            <h3 className="label">Masked secret</h3>
            <div className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2.5">
              <code className="flex-1 break-all font-mono text-sm text-cyan">{f.secret_masked}</code>
              <button
                className="text-ink-400 hover:text-white"
                title="Copy fingerprint"
                onClick={() => { navigator.clipboard?.writeText(f.fingerprint); toast('Fingerprint copied') }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-ink-400">GhostTrace stores only this masked preview and a SHA-256 fingerprint, never the raw secret.</p>
          </section>

          {f.snippet && (
            <section>
              <h3 className="label">Context</h3>
              <pre className="scrollbar-thin overflow-x-auto rounded-lg border border-ink-800 bg-ink-950 p-3 font-mono text-xs text-ink-200">
                {f.line_number && <span className="mr-3 select-none text-ink-500">{f.line_number}</span>}{f.snippet}
              </pre>
            </section>
          )}

          <section>
            <h3 className="label">Why this score</h3>
            <ul className="space-y-2">
              {(f.risk_factors || []).map((r) => (
                <li key={r} className="flex gap-2.5 text-sm text-ink-200"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan" />{r}</li>
              ))}
            </ul>
            <div className="mt-3"><RiskMeter value={f.risk_score} /></div>
          </section>

          <section className="rounded-lg border border-sev-high/30 bg-sev-high/5 p-4">
            <h3 className="text-sm font-semibold text-sev-high">How to fix it</h3>
            <p className="mt-1.5 text-sm text-ink-200">{REMEDIATION[f.category] || REMEDIATION.api_key}</p>
            {f.source_type === 'github' && (
              <p className="mt-2 text-sm text-ink-300">Deleting the file is not enough. The secret stays in git history until it is rotated.</p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-4 text-sm">
            <div><div className="label">First seen</div><div className="text-ink-200">{formatDate(f.first_seen)}</div></div>
            <div><div className="label">Last seen</div><div className="text-ink-200">{formatDate(f.last_seen)}</div></div>
            <div><div className="label">Rule</div><div className="font-mono text-xs text-ink-200">{f.rule_id}</div></div>
            <div><div className="label">Source</div><div className="capitalize text-ink-200">{f.source_type}</div></div>
          </section>

          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-cyan hover:underline">
              {f.commit_sha ? <GitCommit className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              {f.commit_sha ? `View commit ${f.commit_sha.slice(0, 7)} on GitHub` : 'Open file on GitHub'}
            </a>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-ink-800 px-6 py-4">
          {f.status === 'open' ? (
            <>
              <Button onClick={() => setStatus('resolved')} loading={saving === 'resolved'}><CheckCircle2 className="h-4 w-4" /> Mark rotated</Button>
              <Button variant="secondary" onClick={() => setStatus('false_positive')} loading={saving === 'false_positive'}><Ban className="h-4 w-4" /> False positive</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setStatus('open')} loading={saving === 'open'}><RotateCcw className="h-4 w-4" /> Reopen</Button>
          )}
        </div>
      </aside>
    </div>
  )
}
