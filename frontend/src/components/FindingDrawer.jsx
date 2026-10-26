import { useState } from 'react'
import { ExternalLink, GitCommit, CheckCircle2, Ban, RotateCcw, Copy, Wrench } from 'lucide-react'
import { Button, Notice, RiskMeter, SeverityBadge, Sheet, StatusBadge } from './ui'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useToast } from './Toast'
import { FixPanel } from './GitHubFix'

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

function Stat({ label, value }) {
  return (
    <div className="rounded-row bg-white/[0.06] p-3">
      <div className="text-caption text-label-3">{label}</div>
      <div className="mt-0.5 text-title2 tabular-nums text-label">{value}</div>
    </div>
  )
}

function Meta({ label, children }) {
  return (
    <div>
      <div className="label !px-0">{label}</div>
      <div className="text-subhead text-label">{children}</div>
    </div>
  )
}

export default function FindingDrawer({ finding, onClose, onChange }) {
  const toast = useToast()
  const [saving, setSaving] = useState(null)
  const f = finding

  async function setStatus(status) {
    setSaving(status)
    try {
      const updated = await api(`/api/findings/${f.id}`, { method: 'PATCH', body: { status } })
      onChange?.(updated)
      toast(status === 'open' ? 'Finding reopened' : status === 'resolved' ? 'Marked as rotated' : 'Marked as not a secret')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(null)
    }
  }

  const location = f ? `${f.repository ? f.repository + '/' : ''}${f.file_path || ''}${f.line_number ? ':' + f.line_number : ''}` : ''

  return (
    <Sheet
      open={!!f}
      onClose={onClose}
      title={f?.credential_type || ''}
      footer={f && (
        <div className="flex flex-wrap gap-2">
          {f.status === 'open' ? (
            <>
              <Button onClick={() => setStatus('resolved')} loading={saving === 'resolved'}><CheckCircle2 className="h-4 w-4" /> Mark rotated</Button>
              <Button variant="gray" onClick={() => setStatus('false_positive')} loading={saving === 'false_positive'}><Ban className="h-4 w-4" /> Not a secret</Button>
            </>
          ) : (
            <Button variant="gray" onClick={() => setStatus('open')} loading={saving === 'open'}><RotateCcw className="h-4 w-4" /> Reopen</Button>
          )}
        </div>
      )}
    >
      {f && (
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <SeverityBadge severity={f.severity} />
              <StatusBadge status={f.status} />
              {f.in_history_only && <span className="inline-flex items-center gap-1 text-caption text-label-2"><GitCommit className="h-3 w-3" /> git history only</span>}
            </div>
            <p className="break-all font-mono text-footnote text-label-2">{location}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Risk score" value={Math.round(f.risk_score)} />
            <Stat label="AI confidence" value={`${Math.round(f.confidence * 100)}%`} />
            <Stat label="Entropy" value={f.entropy.toFixed(1)} />
          </div>

          <section>
            <h3 className="label">Masked secret</h3>
            <div className="flex items-center gap-2 rounded-row bg-white/[0.06] px-4 py-3">
              <code className="flex-1 break-all font-mono text-subhead text-label">{f.secret_masked}</code>
              <button
                className="press rounded-full p-1.5 text-label-3 hover:bg-white/10 hover:text-label"
                title="Copy fingerprint" aria-label="Copy fingerprint"
                onClick={() => { navigator.clipboard?.writeText(f.fingerprint); toast('Fingerprint copied') }}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-footnote text-label-3">GhostTrace stores only this masked preview and a SHA-256 fingerprint, never the raw secret.</p>
          </section>

          {f.snippet && (
            <section>
              <h3 className="label">Context</h3>
              <pre className="thin-scroll overflow-x-auto rounded-row bg-black/40 p-3 font-mono text-footnote text-label-2">
                {f.line_number && <span className="mr-3 select-none text-label-4">{f.line_number}</span>}{f.snippet}
              </pre>
            </section>
          )}

          <section>
            <h3 className="label">Why this score</h3>
            <ul className="space-y-2 px-1">
              {(f.risk_factors || []).map((r) => (
                <li key={r} className="flex gap-2.5 text-subhead text-label"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/60" />{r}</li>
              ))}
            </ul>
            <div className="mt-3 px-1"><RiskMeter value={f.risk_score} wide /></div>
          </section>

          <Notice tone="warn" icon={Wrench}>
            <div className="font-semibold">How to fix it</div>
            <p className="mt-1 text-label-2">{REMEDIATION[f.category] || REMEDIATION.api_key}</p>
            {f.source_type === 'github' && (
              <p className="mt-2 text-label-2">Deleting the file is not enough. The secret stays in git history until it is rotated.</p>
            )}
          </Notice>

          <FixPanel finding={f} onChange={onChange} />

          <section className="grid grid-cols-2 gap-4 px-1">
            <Meta label="First seen">{formatDate(f.first_seen)}</Meta>
            <Meta label="Last seen">{formatDate(f.last_seen)}</Meta>
            <Meta label="Rule"><span className="font-mono text-footnote">{f.rule_id}</span></Meta>
            <Meta label="Source"><span className="capitalize">{f.source_type}</span></Meta>
          </section>

          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-1 text-callout text-tint-light hover:underline">
              {f.commit_sha ? <GitCommit className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
              {f.commit_sha ? `View commit ${f.commit_sha.slice(0, 7)} on GitHub` : 'Open file on GitHub'}
            </a>
          )}
        </div>
      )}
    </Sheet>
  )
}
