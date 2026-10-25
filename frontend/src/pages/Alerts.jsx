import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, MailWarning, Send } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { Button, Card, EmptyState, Group, Notice, PageHeader, PageLoader, Row, StatusBadge } from '../components/ui'
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
        title="Alerts"
        description="Email alerts sent when a scan or monitor finds new credentials above your severity threshold."
        actions={<Button variant="gray" onClick={test} loading={busy}><Send className="h-4 w-4" /> Send test email</Button>}
      />
      {config && !config.email_configured && (
        <Notice tone="warn" icon={MailWarning} className="mb-6">
          Email delivery is not configured on this server yet. Alerts are recorded below as <b>not sent</b> until SMTP settings are added.
        </Notice>
      )}
      {!items ? <PageLoader /> : items.length === 0 ? (
        <Card><EmptyState icon={Bell} title="No alerts yet">When a scan finds new high-risk credentials you will see the alert here.</EmptyState></Card>
      ) : (
        <Group header="Alert log" footer={<>Change your threshold in <Link to="/app/settings" className="text-tint-light hover:underline">Settings</Link>.</>}>
          {items.map((a) => (
            <Row
              key={a.id}
              to={a.scan_id ? `/app/scans/${a.scan_id}` : undefined}
              title={a.subject}
              subtitle={`${formatDate(a.created_at)}${a.error ? ` · ${a.error}` : ''}`}
              trailing={<StatusBadge status={a.status} />}
            />
          ))}
        </Group>
      )}
    </>
  )
}
