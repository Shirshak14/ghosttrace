import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Activity, AlertOctagon, ArrowRight, FileDown, FolderGit2, Radar, ShieldAlert, ShieldCheck, MailWarning } from 'lucide-react'
import { api, download } from '../lib/api'
import { SERIES, SEV_COLORS, tooltip } from '../lib/charts'
import { timeAgo, TARGET_LABELS } from '../lib/format'
import { Button, Card, CardHeader, EmptyState, PageHeader, PageLoader, StatusBadge } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import CountUp from '../components/reactbits/CountUp'
import SpotlightCard from '../components/reactbits/SpotlightCard'

function Kpi({ icon: Icon, label, value, hint, accent = 'text-cyan' }) {
  return (
    <SpotlightCard spotlightColor="#22d3ee" className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums text-white"><CountUp to={value} duration={1.5} separator="," /></div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </SpotlightCard>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([api(`/api/dashboard/summary?days=${days}`), api('/api/dashboard/timeline?limit=7')])
      .then(([s, t]) => { setData(s); setTimeline(t) })
      .catch((e) => toast(e.message, 'error'))
  }, [days, toast])

  if (!data) return <PageLoader />
  const t = data.totals

  if (t.scans === 0 && t.findings === 0) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={`Welcome${user?.full_name ? ', ' + user.full_name.split(' ')[0] : ''}`} />
        <Card className="relative overflow-hidden">
          <div className="grid-bg absolute inset-0 opacity-50" />
          <div className="relative">
            <EmptyState
              icon={Radar}
              title="Run your first exposure scan"
              action={<Button onClick={() => navigate('/app/scans')}>Start a scan <ArrowRight className="h-4 w-4" /></Button>}
            >
              Scan a GitHub user, organization or repository, or paste config files, and GhostTrace will find and score leaked credentials.
            </EmptyState>
          </div>
        </Card>
      </>
    )
  }

  const trendData = {
    labels: data.trend.map((d) => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: ['critical', 'high', 'medium', 'low'].map((s) => ({
      label: s[0].toUpperCase() + s.slice(1),
      data: data.trend.map((d) => d[s]),
      backgroundColor: SEV_COLORS[s],
      borderRadius: 3,
      stack: 'sev',
      maxBarThickness: 18,
    })),
  }
  const sevData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: ['critical', 'high', 'medium', 'low'].map((s) => data.by_severity[s]),
      backgroundColor: ['critical', 'high', 'medium', 'low'].map((s) => SEV_COLORS[s]),
      borderColor: '#08111f',
      borderWidth: 3,
    }],
  }
  const catData = {
    labels: data.by_category.map((c) => c.label),
    datasets: [{ data: data.by_category.map((c) => c.count), backgroundColor: SERIES, borderRadius: 4, maxBarThickness: 22 }],
  }
  const riskData = {
    labels: data.risk_distribution.map((r) => r.bucket),
    datasets: [{
      data: data.risk_distribution.map((r) => r.count),
      backgroundColor: data.risk_distribution.map((_, i) => (i >= 7 ? SEV_COLORS.critical : i >= 5 ? SEV_COLORS.high : i >= 3 ? SEV_COLORS.medium : SEV_COLORS.low)),
      borderRadius: 3,
    }],
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Exposure dashboard"
        description="Every credential GhostTrace has found across your scans, scored by the AI risk model."
        actions={
          <>
            <Button variant="secondary" onClick={() => download('/api/reports/summary.pdf', 'ghosttrace-summary.pdf').catch((e) => toast(e.message, 'error'))}>
              <FileDown className="h-4 w-4" /> PDF report
            </Button>
            <Button onClick={() => navigate('/app/scans')}><Radar className="h-4 w-4" /> New scan</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={ShieldAlert} label="Open findings" value={t.open} hint={`${t.resolved} resolved · ${t.false_positives} false positives`} />
        <Kpi icon={AlertOctagon} label="Critical" value={t.critical_open} hint={`${t.high_open} high severity`} accent="text-sev-critical" />
        <Kpi icon={Activity} label="Avg. risk" value={Math.round(t.avg_risk)} hint="Across open findings, 0–100" accent="text-sev-medium" />
        <Kpi icon={FolderGit2} label="Coverage" value={t.files_scanned} hint={`files · ${t.repositories} repos · ${t.scans} scans`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="New exposures over time"
            subtitle="Findings by the day they were first seen"
            action={
              <select className="rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-xs text-ink-200" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            }
          />
          <div className="h-64 p-4">
            <Bar
              data={trendData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip },
                scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
              }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Open by severity" />
          <div className="relative h-64 p-4">
            <Doughnut data={sevData} options={{ maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip } }} />
            <div className="pointer-events-none absolute inset-x-0 top-[38%] text-center">
              <div className="text-3xl font-bold text-white">{t.open}</div>
              <div className="text-xs text-ink-400">open</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Credential types" subtitle="Open findings by category" />
          <div className="h-64 p-4">
            {data.by_category.length ? (
              <Bar data={catData} options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } }} />
            ) : <EmptyState icon={ShieldCheck} title="Nothing open" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Risk distribution" subtitle="How many open findings fall in each risk band" />
          <div className="h-64 p-4">
            <Bar data={riskData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Most exposed repositories" />
          <ul className="divide-y divide-ink-800">
            {data.top_repositories.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-400">No repository findings yet.</li>}
            {data.top_repositories.map((r) => (
              <li key={r.repository}>
                <Link to={`/app/findings?q=${encodeURIComponent(r.repository)}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-800/40">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-sm text-white">{r.repository}</div>
                    <div className="text-xs text-ink-400">{r.open} open · {r.critical} critical</div>
                  </div>
                  <span className="font-mono text-sm tabular-nums" style={{ color: r.max_risk >= 75 ? SEV_COLORS.critical : r.max_risk >= 55 ? SEV_COLORS.high : SEV_COLORS.medium }}>
                    {Math.round(r.max_risk)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Highest-risk open findings" action={<Link to="/app/findings" className="text-xs font-medium text-cyan hover:underline">View all</Link>} />
          {data.top_findings.length ? <FindingsTable items={data.top_findings} onSelect={setSelected} compact /> : <EmptyState icon={ShieldCheck} title="No open findings">Nice work.</EmptyState>}
        </Card>
        <Card>
          <CardHeader title="Exposure timeline" action={<Link to="/app/alerts" className="text-xs font-medium text-cyan hover:underline">Alerts</Link>} />
          <ol className="relative space-y-4 px-5 py-4">
            {timeline.length === 0 && <li className="text-sm text-ink-400">No activity yet.</li>}
            {timeline.map((e, i) => (
              <li key={i} className="relative pl-5">
                <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full" style={{ background: e.severity ? SEV_COLORS[e.severity] : e.type === 'scan_failed' ? SEV_COLORS.critical : '#22d3ee' }} />
                <div className="text-sm text-white">{e.title}</div>
                <div className="truncate text-xs text-ink-400">{e.detail}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-500">{timeAgo(e.at)}</div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent scans" action={<Link to="/app/scans" className="text-xs font-medium text-cyan hover:underline">All scans</Link>} />
          <ul className="divide-y divide-ink-800">
            {data.recent_scans.map((s) => (
              <li key={s.id}>
                <Link to={`/app/scans/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-800/40">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{s.target}</div>
                    <div className="text-xs text-ink-400">{TARGET_LABELS[s.target_type]} · {timeAgo(s.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-ink-300">{s.findings_count} findings</span>
                    <StatusBadge status={s.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><MailWarning className="h-4 w-4 text-magenta" /> Breach intelligence</div>
            <p className="mt-2 text-sm text-ink-300">
              {t.breached_emails > 0
                ? `${t.breached_emails} of the email addresses you checked appear in known data breaches.`
                : 'Check whether your team’s email addresses and passwords appear in known data breaches.'}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/app/breach')}>Open Breach Intel</Button>
            <Button variant="ghost" onClick={() => navigate('/app/monitors')}>{t.monitors_active} active monitors</Button>
          </div>
        </Card>
      </div>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={(f) => { setSelected(f); setData((d) => ({ ...d, top_findings: d.top_findings.map((x) => (x.id === f.id ? f : x)) })) }}
      />
    </>
  )
}
