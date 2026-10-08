import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileDown, FileSpreadsheet, ShieldCheck, AlertTriangle } from 'lucide-react'
import { api, download } from '../lib/api'
import { formatDate, TARGET_LABELS } from '../lib/format'
import { Button, Card, CardHeader, EmptyState, PageHeader, PageLoader, StatusBadge } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { useToast } from '../components/Toast'

export default function ScanDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [scan, setScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let alive = true
    let timer
    async function load() {
      try {
        const s = await api(`/api/scans/${id}`)
        if (!alive) return
        setScan(s)
        if (s.status === 'completed' || s.status === 'failed') {
          setFindings(await api(`/api/scans/${id}/findings`))
        } else {
          timer = setTimeout(load, 1500)
        }
      } catch (e) {
        toast(e.message, 'error')
      }
    }
    load()
    return () => { alive = false; clearTimeout(timer) }
  }, [id, toast])

  if (!scan) return <PageLoader />
  const running = scan.status === 'running' || scan.status === 'queued'
  const sev = findings.reduce((a, f) => ({ ...a, [f.severity]: (a[f.severity] || 0) + 1 }), {})

  return (
    <>
      <Link to="/app/scans" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> All scans</Link>
      <PageHeader
        eyebrow={TARGET_LABELS[scan.target_type]}
        title={scan.target}
        description={`Started ${formatDate(scan.created_at)}${scan.finished_at ? ` · finished ${formatDate(scan.finished_at)}` : ''}`}
        actions={scan.status === 'completed' && (
          <>
            <Button variant="secondary" onClick={() => download(`/api/reports/findings.csv?scan_id=${scan.id}`, `ghosttrace-scan-${scan.id}.csv`).catch((e) => toast(e.message, 'error'))}>
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
            <Button variant="secondary" onClick={() => download(`/api/reports/scan/${scan.id}.pdf`, `ghosttrace-scan-${scan.id}.pdf`).catch((e) => toast(e.message, 'error'))}>
              <FileDown className="h-4 w-4" /> PDF report
            </Button>
          </>
        )}
      />

      {running && (
        <Card className="relative mb-6 overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-cyan/5 to-transparent animate-scan" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><StatusBadge status={scan.status} /><span className="text-sm text-ink-200">{scan.message}</span></div>
              <span className="font-mono text-sm text-cyan">{scan.progress}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-800">
              <div className="h-full rounded-full bg-gradient-to-r from-signal to-cyan transition-all duration-700" style={{ width: `${scan.progress}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 font-mono text-xs text-ink-400">
              <span>{scan.repos_scanned} repos</span><span>{scan.files_scanned} files</span><span>{scan.commits_scanned} commits</span>
            </div>
          </div>
        </Card>
      )}

      {scan.status === 'failed' && (
        <Card className="mb-6 flex items-start gap-3 border-sev-critical/40 bg-sev-critical/5 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-sev-critical" />
          <div>
            <div className="font-semibold text-white">Scan failed</div>
            <p className="mt-1 text-sm text-ink-300">{scan.error}</p>
          </div>
        </Card>
      )}

      {scan.status === 'completed' && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ['Repos', scan.repos_scanned], ['Files', scan.files_scanned], ['Commits', scan.commits_scanned],
            ['Critical', sev.critical || 0, 'text-sev-critical'], ['High', sev.high || 0, 'text-sev-high'],
            ['Medium', sev.medium || 0, 'text-sev-medium'], ['Low', sev.low || 0, 'text-sev-low'],
          ].map(([l, v, c]) => (
            <Card key={l} className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-ink-400">{l}</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${c || 'text-white'}`}>{v}</div>
            </Card>
          ))}
        </div>
      )}

      {!running && (
        <Card>
          <CardHeader title="Findings" subtitle={scan.message} />
          {findings.length ? <FindingsTable items={findings} onSelect={setSelected} /> : (
            scan.status === 'completed' && <EmptyState icon={ShieldCheck} title="No credentials found">GhostTrace did not find any exposed secrets in this target.</EmptyState>
          )}
        </Card>
      )}

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={(f) => { setSelected(f); setFindings((xs) => xs.map((x) => (x.fingerprint === f.fingerprint ? { ...x, status: f.status } : x))) }}
      />
    </>
  )
}
