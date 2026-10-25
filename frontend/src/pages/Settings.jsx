import { useEffect, useState } from 'react'
import { Bell, Database, Mail } from 'lucide-react'
import { Github } from '../components/icons'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button, Card, Field, Group, PageHeader, Row, Switch } from '../components/ui'
import { useToast } from '../components/Toast'

const GREEN = '#3DDC84'
const ORANGE = '#FFA726'

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
      <PageHeader title="Settings" />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <form onSubmit={save} className="space-y-8">
          <Card className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
              <Field label="Organization"><input className="input" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /></Field>
            </div>
            <Field label="Email" hint="Alerts are sent to this address."><input className="input opacity-60" value={user.email} disabled /></Field>
          </Card>

          <Group header="Alerts" footer="Only findings at or above the threshold trigger an email.">
            <Row
              icon={Bell}
              title="Email me about new leaks"
              trailing={<Switch checked={form.alerts_enabled} onChange={(v) => setForm({ ...form, alerts_enabled: v })} label="Email me about new leaks" />}
            />
            <Row
              icon={Mail}
              title="Alert threshold"
              trailing={
                <select
                  className="rounded-full bg-white/10 px-3 py-1.5 text-subhead text-label"
                  value={form.alert_min_severity}
                  onChange={(e) => setForm({ ...form, alert_min_severity: e.target.value })}
                >
                  <option value="critical">Critical only</option>
                  <option value="high">High and above</option>
                  <option value="medium">Medium and above</option>
                  <option value="low">Everything</option>
                </select>
              }
            />
          </Group>
          <Button type="submit" loading={busy} size="lg">Save changes</Button>
        </form>

        {config && (
          <Group header="Server" className="h-fit" footer="Configured by the administrator in .env.">
            <Row
              icon={Github}
              iconColor={config.github_token_configured ? GREEN : ORANGE}
              title="GitHub API token"
              subtitle={config.github_token_configured ? '5,000 requests/hour' : 'Unauthenticated: 60 requests/hour, small scans only'}
            />
            <Row
              icon={Mail}
              iconColor={config.email_configured ? GREEN : ORANGE}
              title="Email delivery"
              subtitle={config.email_configured ? 'Alerts will be emailed' : 'Alerts are logged but not emailed'}
            />
            <Row icon={Database} iconColor={GREEN} title="Breach database" subtitle={config.breach_source} />
          </Group>
        )}
      </div>
    </>
  )
}
