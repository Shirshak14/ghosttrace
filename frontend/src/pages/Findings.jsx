import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight, FileSpreadsheet, Search, ShieldCheck } from 'lucide-react'
import { api, download } from '../lib/api'
import { Button, Card, EmptyState, Group, PageHeader, PageLoader, Segmented } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { applyUpdate } from '../lib/findings'
import { useToast } from '../components/Toast'

const SEVS = ['critical', 'high', 'medium', 'low']
const CATS = [
  ['aws', 'AWS'], ['cloud', 'Cloud'], ['api_key', 'API keys'], ['token', 'Tokens'], ['jwt', 'JWT'],
  ['private_key', 'Private keys'], ['database', 'Database'], ['password', 'Passwords'], ['email', 'Emails'], ['webhook', 'Webhooks'],
]
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Rotated' },
  { value: 'false_positive', label: 'Not a secret' },
  { value: 'all', label: 'All' },
]

function Chip({ active, onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={clsx('press h-7 whitespace-nowrap rounded-full px-3 text-caption font-medium transition-colors',
        active ? 'bg-white text-black' : 'bg-[#1e1e1e] text-label-2 hover:bg-[#2a2a2a] hover:text-white', className)}
    >
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

  function onChange(f, sameSecret) {
    setSelected((s) => (s?.id === f.id ? f : s))
    setData((d) => ({ ...d, items: d.items.map(applyUpdate(f, sameSecret)) }))
  }

  // The API treats an empty status as "all"; the segmented control needs a non-empty value to select.
  const statusValue = filters.status === '' ? 'all' : filters.status
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1
  const csvParams = new URLSearchParams(qs)
  csvParams.delete('page'); csvParams.delete('page_size'); csvParams.delete('sort')

  return (
    <>
      <PageHeader
        title="Findings"
        description="Every exposed credential, ranked by AI risk. Open one to see why it scored the way it did and how to fix it."
        actions={<Button variant="gray" onClick={() => download(`/api/reports/findings.csv?${csvParams}`, 'ghosttrace-findings.csv').catch((e) => toast(e.message, 'error'))}><FileSpreadsheet className="h-4 w-4" /> Export CSV</Button>}
      />

      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3" />
            <input className="input pl-10" placeholder="Search repository, file, type or owner" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input w-auto" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="risk">Highest risk</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <Segmented options={STATUS_OPTIONS} value={statusValue} onChange={(v) => update({ status: v === 'all' ? '' : v })} />
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {SEVS.map((s) => <Chip key={s} active={filters.severity.split(',').includes(s)} onClick={() => toggle('severity', s)} className="capitalize">{s}</Chip>)}
          <span className="mx-1 w-px shrink-0 bg-white/15" />
          {CATS.map(([c, l]) => <Chip key={c} active={filters.category.split(',').includes(c)} onClick={() => toggle('category', c)}>{l}</Chip>)}
        </div>
      </div>

      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <Card><EmptyState icon={ShieldCheck} color="#3DDC84" title="No findings match">Try clearing filters, or run a new scan.</EmptyState></Card>
      ) : (
        <>
          <Group inset={16}><FindingsTable items={data.items} onSelect={setSelected} onChange={onChange} /></Group>
          <div className="mt-4 flex items-center justify-between px-2 text-footnote text-label-3">
            <span>{data.total} finding{data.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <Button variant="gray" size="sm" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <span>Page {filters.page} of {pages}</span>
              <Button variant="gray" size="sm" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </>
      )}

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={onChange}
      />
    </>
  )
}
