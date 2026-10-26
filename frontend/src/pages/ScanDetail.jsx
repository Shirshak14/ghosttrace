import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, FileDown, FileSpreadsheet, ShieldCheck, AlertTriangle } from 'lucide-react'
import { api, download } from '../lib/api'
import { formatDate, TARGET_LABELS } from '../lib/format'
import { Button, Card, EmptyState, Group, Notice, PageHeader, PageLoader, StatusBadge } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { applyUpdate } from '../lib/findings'
import { useToast } from '../components/Toast'

export default function ScanDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [scan, setScan] = useState(null)
  const [findings, setFindings] = useState([])
  const [selected, setSelected] = useState(null)

  function onChange(f, sameSecret) {
    setSelected((s) => (s?.id === f.id ? f : s))
    setFindings((xs) => xs.map(applyUpdate(f, sameSecret)))
  }

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
      <PageHeader
        back={<Link to="/app/scans" className="mb-3 inline-flex items-center gap-0.5 text-callout text-tint-light hover:underline"><ChevronLeft className="h-5 w-5" /> Scans</Link>}
        title={scan.target}
        description={`${TARGET_LABELS[scan.target_type]} · started ${formatDate(scan.created_at)}${scan.finished_at ? ` · finished ${formatDate(scan.finished_at)}` : ''}`}
        actions={scan.status === 'completed' && (
          <>
            <Button variant="gray" onClick={() => download(`/api/reports/findings.csv?scan_id=${scan.id}`, `ghosttrace-scan-${scan.id}.csv`).catch((e) => toast(e.message, 'error'))}>
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
            <Button variant="gray" onClick={() => download(`/api/reports/scan/${scan.id}.pdf`, `ghosttrace-scan-${scan.id}.pdf`).catch((e) => toast(e.message, 'error'))}>
              <FileDown className="h-4 w-4" /> PDF report
            </Button>
          </>
        )}
      />

      {running && (
        <Card className="mb-6 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><StatusBadge status={scan.status} /><span className="truncate text-subhead text-label-2">{scan.message}</span></div>
            <span className="font-mono text-subhead tabular-nums text-label">{scan.progress}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${scan.progress}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 text-footnote text-label-3">
            <span>{scan.repos_scanned} repos</span><span>{scan.files_scanned} files</span><span>{scan.commits_scanned} commits</span>
          </div>
        </Card>
      )}

      {scan.status === 'failed' && (
        <Notice tone="error" icon={AlertTriangle} className="mb-6">
          <div className="font-semibold">Scan failed</div>
          <p className="mt-0.5 text-label-2">{scan.error}</p>
        </Notice>
      )}

      {scan.status === 'completed' && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ['Repos', scan.repos_scanned], ['Files', scan.files_scanned], ['Commits', scan.commits_scanned],
            ['Critical', sev.critical || 0, '#FF5A52'], ['High', sev.high || 0, '#FFA726'],
            ['Medium', sev.medium || 0, '#F2D95C'], ['Low', sev.low || 0, '#5CC8FF'],
          ].map(([l, v, c]) => (
            <Card key={l} className="p-4">
              <div className="text-footnote text-label-2">{l}</div>
              <div className="mt-1 text-title1 tabular-nums" style={{ color: c || '#fff' }}>{v}</div>
            </Card>
          ))}
        </div>
      )}

      {!running && (findings.length ? (
        <Group header="Findings" footer={scan.message}><FindingsTable items={findings} onSelect={setSelected} onChange={onChange} /></Group>
      ) : (
        scan.status === 'completed' && <Card><EmptyState icon={ShieldCheck} color="#3DDC84" title="No credentials found">GhostTrace did not find any exposed secrets in this target.</EmptyState></Card>
      ))}

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={onChange}
      />
    </>
  )
}
