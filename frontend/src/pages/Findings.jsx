import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search, ShieldCheck } from 'lucide-react'
import { api, download } from '../lib/api'
import { Button, Card, EmptyState, PageHeader, PageLoader } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { useToast } from '../components/Toast'

const SEVS = ['critical', 'high', 'medium', 'low']
const CATS = [
  ['aws', 'AWS'], ['cloud', 'Cloud'], ['api_key', 'API keys'], ['token', 'Tokens'], ['jwt', 'JWT'],
  ['private_key', 'Private keys'], ['database', 'Database'], ['password', 'Passwords'], ['email', 'Emails'], ['webhook', 'Webhooks'],
]
const STATUSES = [['open', 'Open'], ['resolved', 'Resolved'], ['false_positive', 'False positive'], ['', 'All']]

function Chip({ active, onClick, children, className }) {
  return (
    <button onClick={onClick} className={clsx('rounded-full border px-3 py-1 text-xs transition',
      active ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-ink-700 text-ink-300 hover:border-ink-500 hover:text-white', className)}>
      {children}
    </button>
  )
}

export default function Findings() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState(params.get('q') || '')

  const filters = useMemo(() => ({
    severity: params.get('severity') || '',
    category: params.get('category') || '',
    status: params.get('status') ?? 'open',
    q: params.get('q') || '',
    sort: params.get('sort') || 'risk',
    page: Number(params.get('page') || 1),
  }), [params])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v !== '' && v !== null) p.set(k, v) })
    p.set('page_size', 25)
    return p.toString()
  }, [filters])

  useEffect(() => {
    api(`/api/findings?${qs}`).then(setData).catch((e) => toast(e.message, 'error'))
  }, [qs, toast])

  useEffect(() => {
    const t = setTimeout(() => { if (query !== filters.q) update({ q: query }) }, 350)
    return () => clearTimeout(t)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch) {
    const next = new URLSearchParams(params)
    Object.entries({ ...patch, page: patch.page ?? 1 }).forEach(([k, v]) => { if (v === '' || v === null || v === undefined) next.delete(k); else next.set(k, v) })
    if (patch.status === '') next.set('status', '')
    setParams(next, { replace: true })
  }

  function toggle(key, value) {
    const cur = filters[key] ? filters[key].split(',') : []
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
    update({ [key]: next.join(',') })
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const csvParams = new URLSearchParams(qs)
  csvParams.delete('page'); csvParams.delete('page_size'); csvParams.delete('sort')

  return (
    <>
      <PageHeader
        eyebrow="Triage"
        title="Findings"
        description="Every exposed credential, ranked by AI risk. Open one to see why it scored the way it did and how to fix it."
        actions={<Button variant="secondary" onClick={() => download(`/api/reports/findings.csv?${csvParams}`, 'ghosttrace-findings.csv').catch((e) => toast(e.message, 'error'))}><FileSpreadsheet className="h-4 w-4" /> Export CSV</Button>}
      />

      <Card className="mb-4 space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input className="input pl-9" placeholder="Search by repository, file, credential type or organization / user…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <select className="input w-auto" value={filters.status} onChange={(e) => update({ status: e.target.value })}>
              {STATUSES.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
            <select className="input w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
              <option value="risk">Highest risk</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-wider text-ink-500">Severity</span>
          {SEVS.map((s) => <Chip key={s} active={filters.severity.split(',').includes(s)} onClick={() => toggle('severity', s)} className="capitalize">{s}</Chip>)}
          <span className="ml-3 mr-1 text-[11px] uppercase tracking-wider text-ink-500">Type</span>
          {CATS.map(([c, l]) => <Chip key={c} active={filters.category.split(',').includes(c)} onClick={() => toggle('category', c)}>{l}</Chip>)}
        </div>
      </Card>

      <Card>
        {!data ? <PageLoader /> : data.items.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No findings match">Try clearing filters, or run a new scan.</EmptyState>
        ) : (
          <>
            <FindingsTable items={data.items} onSelect={setSelected} />
            <div className="flex items-center justify-between px-5 py-3 text-xs text-ink-400">
              <span>{data.total} finding{data.total === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
                <span>Page {filters.page} of {pages}</span>
                <Button variant="ghost" size="sm" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={(f) => { setSelected(f); setData((d) => ({ ...d, items: d.items.map((x) => (x.fingerprint === f.fingerprint ? { ...x, status: f.status } : x)) })) }}
      />
    </>
  )
}
