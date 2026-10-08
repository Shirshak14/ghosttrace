import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Send } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { Button, Card, CardHeader, EmptyState, PageHeader, PageLoader, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'

export default function Alerts() {
  const toast = useToast()
  const [items, setItems] = useState(null)
  const [config, setConfig] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () => api('/api/alerts').then(setItems).catch((e) => toast(e.message, 'error'))
  useEffect(() => {
    load()
    api('/api/alerts/config').then(setConfig).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function test() {
    setBusy(true)
    try {
      const r = await api('/api/alerts/test', { method: 'POST' })
      toast(`Test email sent to ${r.to}`)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
      load()
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Notifications"
        title="Alerts"
        description="Email alerts sent when a scan or monitor finds new credentials above your severity threshold."
        actions={<Button variant="secondary" onClick={test} loading={busy}><Send className="h-4 w-4" /> Send test email</Button>}
      />
      {config && !config.email_configured && (
        <Card className="mb-4 border-sev-medium/40 bg-sev-medium/5 p-4 text-sm text-ink-200">
          Email delivery is not configured on this server yet. Alerts are recorded below as <b>skipped</b> until SMTP settings are added.
        </Card>
      )}
      <Card>
        <CardHeader title="Alert log" subtitle={<>Change your threshold in <Link to="/app/settings" className="text-cyan hover:underline">Settings</Link></>} />
        {!items ? <PageLoader /> : items.length === 0 ? (
          <EmptyState icon={Bell} title="No alerts yet">When a scan finds new high-risk credentials you will see the alert here.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-800">
            {items.map((a) => (
              <li key={a.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">{a.subject}</div>
                  <div className="text-xs text-ink-400">{formatDate(a.created_at)}{a.error ? ` · ${a.error}` : ''}</div>
                </div>
                <div className="flex items-center gap-3">
                  {a.scan_id && <Link to={`/app/scans/${a.scan_id}`} className="text-xs text-cyan hover:underline">View scan</Link>}
                  <StatusBadge status={a.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
