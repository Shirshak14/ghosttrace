import { useEffect, useState } from 'react'
import { Building2, Eye, FolderGit2, Mail, Play, Trash2, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { TARGET_LABELS, timeAgo } from '../lib/format'
import { Button, Card, EmptyState, Field, Group, PageHeader, PageLoader, Row, Segmented, Switch } from '../components/ui'
import { useConfirm, useToast } from '../components/Toast'

const TYPES = [
  { value: 'github_org', label: 'Org', icon: Building2, placeholder: 'acme-corp' },
  { value: 'github_user', label: 'User', icon: UserIcon, placeholder: 'octocat' },
  { value: 'github_repo', label: 'Repo', icon: FolderGit2, placeholder: 'owner/repo' },
  { value: 'email', label: 'Email', icon: Mail, placeholder: 'security@company.com' },
]

export default function Monitors() {
  const toast = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState(null)
  const [type, setType] = useState('github_org')
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api('/api/monitors').then(setItems).catch((e) => toast(e.message, 'error')) }, [toast])

  async function add(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const m = await api('/api/monitors', { method: 'POST', body: { target_type: type, target } })
      setItems((x) => [m, ...x])
      setTarget('')
      toast('Monitor added. A baseline scan has started.')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(m) {
    const u = await api(`/api/monitors/${m.id}`, { method: 'PATCH', body: { enabled: !m.enabled } })
    setItems((x) => x.map((y) => (y.id === m.id ? u : y)))
  }

  async function runNow(m) {
    await api(`/api/monitors/${m.id}/run`, { method: 'POST' })
    toast(m.target_type === 'email' ? 'Breach check started' : 'Scan started. Follow it on the Scans page.')
  }

  async function remove(m) {
    if (!(await confirm({ title: 'Stop monitoring?', message: m.target, confirmLabel: 'Stop', destructive: true }))) return
    await api(`/api/monitors/${m.id}`, { method: 'DELETE' })
    setItems((x) => x.filter((y) => y.id !== m.id))
  }

  const t = TYPES.find((x) => x.value === type)
  return (
    <>
      <PageHeader title="Monitoring" description="GhostTrace re-scans monitored targets every hour and emails you when a new credential or breach appears." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <form onSubmit={add} className="space-y-4">
            <Segmented options={TYPES} value={type} onChange={setType} size="sm" />
            <Field label="Target"><input className="input font-mono" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t.placeholder} /></Field>
            <Button type="submit" loading={busy} className="w-full"><Eye className="h-4 w-4" /> Start monitoring</Button>
          </form>
        </Card>
        {!items ? <PageLoader /> : items.length === 0 ? (
          <Card><EmptyState icon={Eye} title="Nothing monitored yet">Add your GitHub organization or team emails to get alerted on new leaks.</EmptyState></Card>
        ) : (
          <Group header="Active monitors">
            {items.map((m) => {
              const icon = (TYPES.find((x) => x.value === m.target_type) || TYPES[0]).icon
              return (
                <Row
                  key={m.id}
                  icon={icon}
                  title={<span className="font-mono text-callout">{m.target}</span>}
                  subtitle={`${TARGET_LABELS[m.target_type]} · last run ${timeAgo(m.last_run_at)}`}
                  trailing={
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => runNow(m)} aria-label="Run now"><Play className="h-3.5 w-3.5" /><span className="hidden sm:inline">Run now</span></Button>
                      <button onClick={() => remove(m)} className="press rounded-full p-2 text-label-3 hover:bg-white/10 hover:text-ios-red" aria-label="Delete monitor"><Trash2 className="h-4 w-4" /></button>
                      <Switch checked={m.enabled} onChange={() => toggle(m)} label="Toggle monitor" />
                    </div>
                  }
                />
              )
            })}
          </Group>
        )}
      </div>
    </>
  )
}
