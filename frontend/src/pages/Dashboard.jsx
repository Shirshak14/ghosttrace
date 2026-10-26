import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar } from 'react-chartjs-2'
import { motion } from 'motion/react'
import { ArrowRight, FileDown, Radar, ShieldCheck, MailWarning } from 'lucide-react'
import { api, download } from '../lib/api'
import { SEV_COLORS, tooltip } from '../lib/charts'
import { timeAgo, TARGET_LABELS } from '../lib/format'
import { Button, Card, EmptyState, Group, PageHeader, PageLoader, Row, StatusBadge } from '../components/ui'
import FindingsTable from '../components/FindingsTable'
import FindingDrawer from '../components/FindingDrawer'
import { applyUpdate } from '../lib/findings'
import { useAuth } from '../lib/auth'
import { useToast } from '../components/Toast'
import CountUp from '../components/CountUp'

function Ring({ critical = 0, high = 0, medium = 0, size = 196 }) {
  const total = Math.max(critical + high + medium, 1)
  const rings = [
    { value: critical, color: '#FF5A52' },
    { value: high, color: '#FFA726' },
    { value: medium, color: '#F2D95C' },
  ]
  const stroke = size * 0.105
  const gap = stroke * 0.22
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + gap)
        const circ = 2 * Math.PI * radius
        const frac = r.value ? Math.max(0.04, r.value / total) : 0
        return (
          <g key={i}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity="0.2" strokeWidth={stroke} />
            <motion.circle
              cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ * (1 - frac) }}
              transition={{ type: 'spring', stiffness: 50, damping: 16, delay: 0.15 + i * 0.12 }}
            />
          </g>
        )
      })}
    </svg>
  )
}

function Legend({ color, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-subhead text-label-2">{label}</span>
      <span className="ml-auto text-headline tabular-nums text-label">{value}</span>
    </div>
  )
}

function Stat({ label, value, hint, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 30 }}>
    <Card className="h-full p-4">
      <div className="text-footnote text-label-2">{label}</div>
      <div className="mt-1 text-title1 tabular-nums text-label"><CountUp to={value} duration={1.2} /></div>
      {hint && <div className="mt-0.5 text-footnote text-label-3">{hint}</div>}
    </Card>
    </motion.div>
  )
}

function headline(t) {
  if (t.open === 0) return 'Nothing is leaking right now.'
  if (t.critical_open > 0) return `${t.critical_open} critical ${t.critical_open === 1 ? 'leak needs' : 'leaks need'} fixing now.`
  return `${t.open} open ${t.open === 1 ? 'finding' : 'findings'} to review.`
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [days, setDays] = useState(30)
  const [selected, setSelected] = useState(null)

  function onChange(f, sameSecret) {
    setSelected((s) => (s?.id === f.id ? f : s))
    setData((d) => ({ ...d, top_findings: d.top_findings.map(applyUpdate(f, sameSecret)) }))
  }

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
        <PageHeader title={user?.full_name ? `Hi, ${user.full_name.split(' ')[0]}` : 'Welcome'} description="Let’s see what you have exposed. It takes about a minute." />
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
      borderColor: '#121212',
      borderWidth: 2,
      borderRadius: 6,
      borderSkipped: false,
      stack: 'sev',
      maxBarThickness: 14,
    })),
  }
  const maxCat = Math.max(1, ...data.by_category.map((c) => c.count))

  return (
    <>
      <PageHeader
        title={user?.full_name ? `Hi, ${user.full_name.split(' ')[0]}` : 'Home'}
        actions={
          <>
            <Button variant="secondary" onClick={() => download('/api/reports/summary.pdf', 'ghosttrace-summary.pdf').catch((e) => toast(e.message, 'error'))}>
              <FileDown className="h-4 w-4" /> PDF report
            </Button>
            <Button onClick={() => navigate('/app/scans')}><Radar className="h-4 w-4" /> New scan</Button>
          </>
        }
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row">
          <div className="relative">
            <Ring critical={t.critical_open} high={t.high_open} medium={Math.max(t.open - t.critical_open - t.high_open, 0)} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {t.open === 0 ? <ShieldCheck className="h-9 w-9 text-ios-green" /> : (
                <>
                  <span className="text-title3 font-semibold leading-none tabular-nums text-label"><CountUp to={t.open} duration={1.1} /></span>
                  <span className="mt-0.5 text-caption2 text-label-2">open</span>
                </>
              )}
            </div>
          </div>
          <div className="w-full min-w-0 flex-1">
            <p className="text-title2 text-label sm:text-title1">{headline(t)}</p>
            <div className="mt-5 max-w-xs space-y-2.5">
              <Legend color="#FF5A52" label="Critical" value={t.critical_open} />
              <Legend color="#FFA726" label="High" value={t.high_open} />
              <Legend color="#F2D95C" label="Medium and low" value={Math.max(t.open - t.critical_open - t.high_open, 0)} />
            </div>
            {t.open > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => navigate(t.critical_open ? '/app/findings?severity=critical' : '/app/findings')}>
                  Review {t.critical_open ? 'critical leaks' : 'findings'}
                </Button>
                {t.resolved > 0 && <Button variant="ghost" onClick={() => navigate('/app/findings?status=resolved')}>{t.resolved} fixed so far</Button>}
              </div>
            )}
          </div>
        </div>
      </Card>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Average risk" value={Math.round(t.avg_risk)} hint="of 100, open findings" delay={0.05} />
        <Stat label="Files checked" value={t.files_scanned} hint={`${t.repositories} ${t.repositories === 1 ? 'repository' : 'repositories'}`} delay={0.1} />
        <Stat label="Scans" value={t.scans} hint={`${t.monitors_active} on a schedule`} delay={0.15} />
        <Stat label="Breached emails" value={t.breached_emails} hint="of the ones you checked" delay={0.2} />
      </div>

      <div className="mt-8">
        <Card className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="text-footnote font-medium text-label-2">New leaks over time</h2>
            <select className="rounded-full bg-white/10 px-3 py-1.5 text-footnote text-label-2" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div className="mt-5 h-52">
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
      </div>

      {data.top_findings.length > 0 && (
        <Group
          className="mt-8"
          header="Fix these first"
          action={<Link to="/app/findings" className="text-callout text-tint-light hover:underline">See all</Link>}
        >
          <FindingsTable items={data.top_findings.slice(0, 6)} onSelect={setSelected} onChange={onChange} compact />
        </Group>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="text-footnote font-medium text-label-2">What leaked</h2>
          {data.by_category.length === 0 ? (
            <EmptyState icon={ShieldCheck} color="#3DDC84" title="Nothing open" />
          ) : (
            <div className="mt-5 space-y-4">
              {data.by_category.slice(0, 6).map((c, i) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-subhead text-label">{c.label}</span>
                    <span className="shrink-0 text-subhead tabular-nums text-label-2">{c.count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1e1e1e]">
                    <motion.div
                      className="h-full rounded-full bg-white"
                      style={{ opacity: Math.max(0.35, 1 - i * 0.15) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(4, (c.count / maxCat) * 100)}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.1 + i * 0.06 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Group className="lg:col-span-2" header="Most exposed">
          {data.top_repositories.length === 0 && <p className="px-5 py-8 text-center text-subhead text-label-3">No repository findings yet.</p>}
          {data.top_repositories.map((r) => (
            <Row
              key={r.repository}
              to={`/app/findings?q=${encodeURIComponent(r.repository)}`}
              title={<span className="font-mono text-callout">{r.repository}</span>}
              subtitle={`${r.open} open · ${r.critical} critical`}
              detail={<span className="font-mono text-callout tabular-nums" style={{ color: r.max_risk >= 75 ? SEV_COLORS.critical : r.max_risk >= 55 ? SEV_COLORS.high : SEV_COLORS.medium }}>{Math.round(r.max_risk)}</span>}
            />
          ))}
        </Group>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Group header="Recent scans" action={<Link to="/app/scans" className="text-callout text-tint-light hover:underline">All scans</Link>}>
          {data.recent_scans.map((s) => (
            <Row
              key={s.id}
              to={`/app/scans/${s.id}`}
              title={<span className="font-mono text-callout">{s.target}</span>}
              subtitle={`${TARGET_LABELS[s.target_type]} · ${s.findings_count} findings · ${timeAgo(s.created_at)}`}
              trailing={<StatusBadge status={s.status} />}
            />
          ))}
        </Group>
        <Group header="Activity" action={<Link to="/app/alerts" className="text-callout text-tint-light hover:underline">Alerts</Link>}>
          {timeline.length === 0 && <p className="px-5 py-8 text-center text-subhead text-label-3">No activity yet.</p>}
          {timeline.map((e, i) => (
            <Row
              key={i}
              leading={<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.severity ? SEV_COLORS[e.severity] : e.type === 'scan_failed' ? SEV_COLORS.critical : '#ffffff' }} />}
              title={e.title}
              subtitle={e.detail}
              detail={<span className="text-footnote">{timeAgo(e.at)}</span>}
            />
          ))}
        </Group>
      </div>

      <Card className="mt-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <MailWarning className="h-8 w-8 shrink-0 text-ios-orange" />
        <div className="flex-1">
          <div className="text-headline text-label">{t.breached_emails > 0 ? `${t.breached_emails} of your emails were breached` : 'Check your team’s email addresses'}</div>
          <div className="text-subhead text-label-2">See whether they appear in known data breaches, and get told when they do.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/app/breach')}>Check an email</Button>
          <Button variant="ghost" onClick={() => navigate('/app/monitors')}>{t.monitors_active} monitors</Button>
        </div>
      </Card>

      <FindingDrawer
        finding={selected}
        onClose={() => setSelected(null)}
        onChange={onChange}
      />
    </>
  )
}
