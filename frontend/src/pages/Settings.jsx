import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Card, CardHeader, Field, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'

function Status({ ok, label, hint }) {
  return (
    <li className="flex items-start gap-3 py-3">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 text-sev-medium" />}
      <div><div className="text-sm text-white">{label}</div><div className="text-xs text-ink-400">{hint}</div></div>
    </li>
  )
}

export default function Settings() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({
    full_name: user.full_name, organization: user.organization, alerts_enabled: user.alerts_enabled, alert_min_severity: user.alert_min_severity,
  })
  const [config, setConfig] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api('/api/alerts/config').then(setConfig).catch(() => {}) }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      setUser(await api('/api/auth/me', { method: 'PATCH', body: form }))
      toast('Settings saved')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }


  return (
    <>
      <PageHeader eyebrow="Workspace" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Profile and alerts" />
          <form onSubmit={save} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Organization"><input className="input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></Field>
            </div>
            <Field label="Email" hint="Alerts are sent to this address."><input className="input opacity-70" value={user.email} disabled /></Field>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="accent-cyan" checked={form.alerts_enabled} onChange={(e) => setForm({ ...form, alerts_enabled: e.target.checked })} />
              <span className="text-sm text-white">Email me when new credentials are found</span>
            </label>
            <Field label="Alert threshold" hint="Only findings at or above this severity trigger an email.">
              <select className="input" value={form.alert_min_severity} onChange={(e) => setForm({ ...form, alert_min_severity: e.target.value })}>
                <option value="critical">Critical only</option>
                <option value="high">High and above</option>
                <option value="medium">Medium and above</option>
                <option value="low">Everything</option>
              </select>
            </Field>
            <Button type="submit" loading={busy}>Save changes</Button>
          </form>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Server integrations" subtitle="Configured by the administrator in .env" />
          {config && (
            <ul className="divide-y divide-ink-800 px-5">
              <Status ok={config.github_token_configured} label="GitHub API token" hint={config.github_token_configured ? '5,000 requests/hour' : 'Unauthenticated: 60 requests/hour, small scans only'} />
              <Status ok={config.email_configured} label="Email delivery (SMTP)" hint={config.email_configured ? 'Alerts will be emailed' : 'Alerts are logged but not emailed'} />
              <Status ok label="Breach database" hint={config.breach_source} />
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
