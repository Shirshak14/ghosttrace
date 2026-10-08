import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Building2, ClipboardPaste, FolderGit2, Trash2, Upload, User as UserIcon, Radar, FileArchive } from 'lucide-react'
import { api } from '../lib/api'
import { Github } from '../components/icons'
import { TARGET_LABELS, timeAgo } from '../lib/format'
import { Button, Card, CardHeader, EmptyState, Field, PageHeader, PageLoader, RiskMeter, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'

const MODES = [
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'text', label: 'Paste text', icon: ClipboardPaste },
  { id: 'upload', label: 'Upload files', icon: Upload },
]
const GH_TYPES = [
  { id: 'github_repo', label: 'Repository', icon: FolderGit2, placeholder: 'owner/repo or https://github.com/owner/repo' },
  { id: 'github_user', label: 'User', icon: UserIcon, placeholder: 'GitHub username, e.g. torvalds' },
  { id: 'github_org', label: 'Organization', icon: Building2, placeholder: 'Organization name, e.g. acme-corp' },
]

function NewScan({ onCreated }) {
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [mode, setMode] = useState('github')
  const [ghType, setGhType] = useState('github_repo')
  const [target, setTarget] = useState('')
  const [history, setHistory] = useState(true)
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      let scan
      if (mode === 'github') {
        scan = await api('/api/scans/github', { method: 'POST', body: { target_type: ghType, target, include_history: history } })
      } else if (mode === 'text') {
        scan = await api('/api/scans/text', { method: 'POST', body: { content: text, label: label || 'Pasted text' } })
      } else {
        const form = new FormData()
        form.append('file', file)
        form.append('label', label)
        scan = await api('/api/scans/upload', { method: 'POST', form })
      }
      onCreated(scan)
      navigate(`/app/scans/${scan.id}`)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const gh = GH_TYPES.find((g) => g.id === ghType)
  return (
    <Card>
      <div className="flex gap-1 border-b border-ink-800 p-2">
        {MODES.map(({ id, label: l, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={clsx('flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition sm:flex-none',
              mode === id ? 'bg-ink-800 text-white' : 'text-ink-400 hover:text-white')}
          >
            <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{l}</span>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-5 p-5">
        {mode === 'github' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {GH_TYPES.map(({ id, label: l, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setGhType(id)}
                  className={clsx('flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs transition',
                    ghType === id ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-ink-700 text-ink-300 hover:border-ink-500')}
                >
                  <Icon className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>
            <Field label="Target">
              <input className="input font-mono" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={gh.placeholder} />
            </Field>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-800 bg-ink-950/40 p-3">
              <input type="checkbox" className="mt-0.5 accent-cyan" checked={history} onChange={(e) => setHistory(e.target.checked)} />
              <span>
                <span className="block text-sm text-white">Scan recent commit history</span>
                <span className="block text-xs text-ink-400">Catches secrets that were committed and later deleted. They are still public.</span>
              </span>
            </label>
          </>
        )}
        {mode === 'text' && (
          <>
            <Field label="Label" hint="A name for this scan, e.g. the file the text came from (.env, config.yml).">
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder=".env" />
            </Field>
            <Field label="Content">
              <textarea className="input min-h-[200px] font-mono text-xs" required value={text} onChange={(e) => setText(e.target.value)}
                placeholder={'Paste code, config files, logs or a paste-site dump.\nNothing you paste is stored, only masked findings.'} />
            </Field>
          </>
        )}
        {mode === 'upload' && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setFile(e.dataTransfer.files[0]) }}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-700 px-6 py-10 text-center transition hover:border-cyan/50"
            >
              <FileArchive className="h-7 w-7 text-cyan" />
              <span className="text-sm text-white">{file ? file.name : 'Drop a file or .zip of a project here'}</span>
              <span className="text-xs text-ink-400">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Up to 20 MB. Zip archives are unpacked and every text file is scanned.'}</span>
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </>
        )}
        <Button type="submit" loading={busy} disabled={mode === 'upload' && !file} className="w-full">
          <Radar className="h-4 w-4" /> Start scan
        </Button>
      </form>
    </Card>
  )
}

export default function Scans() {
  const toast = useToast()
  const [scans, setScans] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => api('/api/scans?limit=100').then((s) => alive && setScans(s)).catch((e) => toast(e.message, 'error'))
    load()
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [toast])

  async function remove(scan) {
    if (!window.confirm(`Delete scan of ${scan.target} and its findings?`)) return
    try {
      await api(`/api/scans/${scan.id}`, { method: 'DELETE' })
      setScans((s) => s.filter((x) => x.id !== scan.id))
      toast('Scan deleted')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <>
      <PageHeader eyebrow="Collection" title="Scans" description="Point GhostTrace at a GitHub target, paste content, or upload a project to find exposed credentials." />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div><NewScan onCreated={(s) => setScans((x) => [s, ...(x || [])])} /></div>
        <Card>
          <CardHeader title="Scan history" subtitle="Refreshes automatically while scans run" />
          {!scans ? <PageLoader /> : scans.length === 0 ? (
            <EmptyState icon={Radar} title="No scans yet">Your scans will appear here.</EmptyState>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-3 font-medium">Target</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Findings</th>
                    <th className="px-3 py-3 font-medium">Max risk</th>
                    <th className="px-3 py-3 font-medium">Started</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s) => (
                    <tr key={s.id} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                      <td className="px-5 py-3">
                        <Link to={`/app/scans/${s.id}`} className="block">
                          <div className="font-medium text-white hover:text-cyan">{s.target}</div>
                          <div className="text-xs text-ink-400">{TARGET_LABELS[s.target_type]}{s.monitor_id ? ' · monitor' : ''}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={s.status} />
                        {s.status === 'running' && (
                          <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-ink-800"><div className="h-full bg-cyan transition-all" style={{ width: `${s.progress}%` }} /></div>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-ink-200">{s.findings_count}</td>
                      <td className="px-3 py-3"><RiskMeter value={s.max_risk} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-ink-400">{timeAgo(s.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => remove(s)} disabled={s.status === 'running'} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-800 hover:text-sev-critical disabled:opacity-30" aria-label="Delete scan">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
