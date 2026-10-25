import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, ClipboardPaste, FileArchive, FolderGit2, Radar, Trash2, Upload, User as UserIcon } from 'lucide-react'
import { api } from '../lib/api'
import { Github } from '../components/icons'
import { TARGET_LABELS, timeAgo } from '../lib/format'
import { Button, Card, EmptyState, Field, Group, PageHeader, PageLoader, Row, Segmented, StatusBadge, Switch } from '../components/ui'
import { useConfirm, useToast } from '../components/Toast'

const MODES = [
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'text', label: 'Paste', icon: ClipboardPaste },
  { value: 'upload', label: 'Upload', icon: Upload },
]
const GH_TYPES = [
  { value: 'github_repo', label: 'Repository', icon: FolderGit2, placeholder: 'owner/repo or https://github.com/owner/repo' },
  { value: 'github_user', label: 'User', icon: UserIcon, placeholder: 'GitHub username, e.g. torvalds' },
  { value: 'github_org', label: 'Organization', icon: Building2, placeholder: 'Organization name, e.g. acme-corp' },
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

  const gh = GH_TYPES.find((g) => g.value === ghType)
  return (
    <Card className="p-5">
      <Segmented options={MODES} value={mode} onChange={setMode} />
      <form onSubmit={submit} className="mt-5 space-y-5">
        {mode === 'github' && (
          <>
            <Segmented options={GH_TYPES} value={ghType} onChange={setGhType} size="sm" />
            <Field label="Target">
              <input className="input font-mono" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder={gh.placeholder} />
            </Field>
            <div className="flex items-center gap-3 rounded-row bg-white/[0.06] p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-callout text-label">Scan recent commit history</span>
                <span className="block text-footnote text-label-3">Catches secrets that were committed and later deleted. They are still public.</span>
              </span>
              <Switch checked={history} onChange={setHistory} label="Scan recent commit history" />
            </div>
          </>
        )}
        {mode === 'text' && (
          <>
            <Field label="Label" hint="A name for this scan, e.g. the file the text came from (.env, config.yml).">
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder=".env" />
            </Field>
            <Field label="Content">
              <textarea
                className="input min-h-[200px] font-mono text-xs" required value={text} onChange={(e) => setText(e.target.value)}
                placeholder={'Paste code, config files, logs or a paste-site dump.\nNothing you paste is stored, only masked findings.'}
              />
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
              className="flex w-full flex-col items-center justify-center gap-2 rounded-row bg-white/[0.06] px-6 py-10 text-center transition hover:bg-white/10"
            >
              <FileArchive className="h-7 w-7 text-label-2" />
              <span className="text-callout text-label">{file ? file.name : 'Drop a file or .zip of a project here'}</span>
              <span className="text-footnote text-label-3">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Up to 20 MB. Zip archives are unpacked and every text file is scanned.'}</span>
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </>
        )}
        <Button type="submit" loading={busy} disabled={mode === 'upload' && !file} size="lg" className="w-full">
          <Radar className="h-4 w-4" /> Start scan
        </Button>
      </form>
    </Card>
  )
}

export default function Scans() {
  const toast = useToast()
  const confirm = useConfirm()
  const [scans, setScans] = useState(null)

  useEffect(() => {
    let alive = true
    const load = () => api('/api/scans?limit=100').then((s) => alive && setScans(s)).catch((e) => toast(e.message, 'error'))
    load()
    const id = setInterval(load, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [toast])

  async function remove(scan) {
    if (!(await confirm({ title: 'Delete this scan?', message: `${scan.target} and its findings will be removed.`, confirmLabel: 'Delete', destructive: true }))) return
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
      <PageHeader title="Scan" description="Point GhostTrace at a GitHub target, paste content, or upload a project to find exposed credentials." />
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        <div><NewScan onCreated={(s) => setScans((x) => [s, ...(x || [])])} /></div>
        {!scans ? <PageLoader /> : scans.length === 0 ? (
          <Card><EmptyState icon={Radar} title="No scans yet">Your scans will appear here.</EmptyState></Card>
        ) : (
          <Group header="History" footer="Refreshes automatically while scans run.">
            {scans.map((s) => (
              <Row
                key={s.id}
                to={`/app/scans/${s.id}`}
                title={<span className="font-mono text-callout">{s.target}</span>}
                subtitle={
                  <>
                    {TARGET_LABELS[s.target_type]}{s.monitor_id ? ' · monitor' : ''} · {s.findings_count} {s.findings_count === 1 ? 'finding' : 'findings'} · {timeAgo(s.created_at)}
                    {s.status === 'running' && (
                      <span className="mt-1.5 block h-1 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-white transition-all" style={{ width: `${s.progress}%` }} /></span>
                    )}
                  </>
                }
                trailing={
                  <>
                    <StatusBadge status={s.status} />
                    <span
                      role="button" tabIndex={0} aria-label="Delete scan"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (s.status !== 'running') remove(s) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (s.status !== 'running') remove(s) } }}
                      className={'rounded-full p-2 text-label-3 hover:bg-white/10 hover:text-ios-red ' + (s.status === 'running' ? 'pointer-events-none opacity-30' : '')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </>
                }
              />
            ))}
          </Group>
        )}
      </div>
    </>
  )
}
