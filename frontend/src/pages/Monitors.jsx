import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Building2, Eye, FolderGit2, Mail, Play, Trash2, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { TARGET_LABELS, timeAgo } from '../lib/format'
import { Button, Card, CardHeader, EmptyState, Field, PageHeader, PageLoader } from '../components/ui'
import { useToast } from '../components/Toast'

const TYPES = [
  { id: 'github_org', label: 'GitHub org', icon: Building2, placeholder: 'acme-corp' },
  { id: 'github_user', label: 'GitHub user', icon: UserIcon, placeholder: 'octocat' },
  { id: 'github_repo', label: 'Repository', icon: FolderGit2, placeholder: 'owner/repo' },
  { id: 'email', label: 'Email', icon: Mail, placeholder: 'security@company.com' },
]

export default function Monitors() {
  const toast = useToast()
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
    if (!window.confirm(`Stop monitoring ${m.target}?`)) return
    await api(`/api/monitors/${m.id}`, { method: 'DELETE' })
    setItems((x) => x.filter((y) => y.id !== m.id))
  }

  const t = TYPES.find((x) => x.id === type)
  return (
    <>
      <PageHeader eyebrow="Continuous" title="Monitors" description="GhostTrace re-scans monitored targets every hour and emails you when a new credential or breach appears." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit p-5">
          <form onSubmit={add} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(({ id, label, icon: Icon }) => (
                <button type="button" key={id} onClick={() => setType(id)}
                  className={clsx('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
                    type === id ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-ink-700 text-ink-300 hover:border-ink-500')}>
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <Field label="Target"><input className="input font-mono" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t.placeholder} /></Field>
            <Button type="submit" loading={busy} className="w-full"><Eye className="h-4 w-4" /> Start monitoring</Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Active monitors" />
          {!items ? <PageLoader /> : items.length === 0 ? (
            <EmptyState icon={Eye} title="Nothing monitored yet">Add your GitHub organization or team emails to get alerted on new leaks.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-800">
              {items.map((m) => {
                const Icon = (TYPES.find((x) => x.id === m.target_type) || TYPES[0]).icon
                return (
                  <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border border-ink-700 bg-ink-950 p-2"><Icon className="h-4 w-4 text-cyan" /></div>
                      <div>
                        <div className="font-mono text-sm text-white">{m.target}</div>
                        <div className="text-xs text-ink-400">{TARGET_LABELS[m.target_type]} · last run {timeAgo(m.last_run_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggle(m)} className={clsx('relative h-5 w-9 rounded-full transition', m.enabled ? 'bg-cyan' : 'bg-ink-700')} aria-label="Toggle monitor">
                        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition', m.enabled ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                      <Button variant="ghost" size="sm" onClick={() => runNow(m)}><Play className="h-3.5 w-3.5" /> Run now</Button>
                      <button onClick={() => remove(m)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-800 hover:text-sev-critical" aria-label="Delete monitor"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
