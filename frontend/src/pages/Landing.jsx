import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Brain, FileDown, GitCommitHorizontal, Lock, MailWarning, Radar, ScanSearch, BellRing } from 'lucide-react'
import Logo, { GhostMark } from '../components/Logo'
import { IconTile } from '../components/ui'
import { useAuth } from '../lib/auth'

const NOTIFICATIONS = [
  { title: 'AWS access key exposed', body: 'acme/infra · deploy.sh line 14', risk: 96, color: '#FF5A52', time: 'now' },
  { title: 'GitHub token in commit history', body: 'acme/sync · removed 3 weeks ago, still public', risk: 84, color: '#FFA726', time: '2m ago' },
  { title: 'Postgres password committed', body: 'acme/api · .env.production', risk: 79, color: '#FFA726', time: '4m ago' },
  { title: 'security@acme.dev in a new breach', body: 'Found in 2 breaches · passwords exposed', risk: 62, color: '#FFA726', time: '9m ago' },
  { title: 'Stripe test key ignored', body: 'acme/web · tests/fixtures · low risk', risk: 12, color: '#5CC8FF', time: '12m ago' },
]

const STEPS = [
  { icon: Radar, color: '#BDBDBD', title: 'Point it at your code', text: 'Paste a GitHub repo, a username or an organization, or drop in a project. Commit history is included, so deleted secrets are found too.' },
  { icon: Brain, color: '#FFFFFF', title: 'AI sorts real from noise', text: '49 detectors find candidates. A trained model scores each one, so live production keys rise to the top and test keys and placeholders sink.' },
  { icon: BellRing, color: '#F2F2F2', title: 'You hear about it first', text: 'Monitored repos and email addresses are re-checked on a schedule, and anything new above your threshold lands in your inbox.' },
]

const SAMPLE = [
  { code: 'AWS_SECRET_ACCESS_KEY="wJal••••••••••EKEY"', verdict: 'Real key · risk 96', color: '#FF5A52' },
  { code: 'DATABASE_URL="postgres://admin:••••@db.acme.io"', verdict: 'Real password · risk 79', color: '#FFA726' },
  { code: 'STRIPE_KEY="sk_test_••••••••••••"', verdict: 'Test key · ignored', color: '#5CC8FF' },
  { code: 'API_KEY="YOUR_API_KEY"', verdict: 'Placeholder · ignored', color: '#8C8C8C' },
]

const DETECTORS = [
  'AWS keys', 'GitHub tokens', 'Google Cloud', 'Azure', 'Stripe', 'OpenAI', 'Anthropic', 'Slack', 'Twilio', 'SendGrid',
  'JWTs', 'SSH and PEM keys', 'Database URLs', 'Hard-coded passwords', 'npm and PyPI tokens', 'Webhooks', 'Email addresses',
]

function Notification({ n }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-white/[0.12] px-3.5 py-3 backdrop-blur">
      <GhostMark className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-footnote font-semibold text-label">{n.title}</span>
          <span className="shrink-0 text-caption2 text-label-3">{n.time}</span>
        </div>
        <div className="truncate text-caption text-label-2">{n.body}</div>
      </div>
      <span className="shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold" style={{ color: n.color, background: `color-mix(in srgb, ${n.color} 18%, transparent)` }}>{n.risk}</span>
    </div>
  )
}

// Shows four notifications at a time and brings in a new one every few seconds, like a live feed.
function useFeed(items, size = 4, every = 2800) {
  const [start, setStart] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const id = setInterval(() => setStart((x) => x + 1), every)
    return () => clearInterval(id)
  }, [every])
  return Array.from({ length: size }, (_, i) => items[(start + size - 1 - i + items.length * 100) % items.length])
}

export default function Landing() {
  const { user } = useAuth()
  const feed = useFeed(NOTIFICATIONS)
  const cta = user ? '/app/scans' : '/register'
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="relative z-30 mx-auto flex max-w-6xl px-3 pt-3 sm:px-6">
        <div className="glass-bar flex h-14 w-full items-center justify-between rounded-full pl-4 pr-2">
          <Logo />
          <nav className="hidden items-center gap-7 text-subhead text-label-2 md:flex">
            <a href="#how" className="hover:text-label">How it works</a>
            <a href="#finds" className="hover:text-label">What it finds</a>
            <a href="#privacy" className="hover:text-label">Privacy</a>
          </nav>
          {user ? (
            <Link to="/app" className="press inline-flex h-10 items-center rounded-full bg-white px-5 text-callout font-semibold text-black">Open GhostTrace</Link>
          ) : (
            <div className="flex items-center gap-1">
              <Link to="/login" className="press inline-flex h-10 items-center rounded-full px-4 text-callout text-label-2 hover:text-label">Sign in</Link>
              <Link to="/register" className="press inline-flex h-10 items-center rounded-full bg-white px-5 text-callout font-semibold text-black">Get started</Link>
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center justify-items-center gap-10 px-5 pb-24 pt-16 text-center sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:justify-items-start lg:gap-14 lg:pt-20 lg:text-left">
        <motion.div
          className="flex flex-col items-center lg:items-start"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        >
          <h1 className="text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-label sm:text-[64px] lg:text-[72px]">Know the moment a key leaks.</h1>
          <p className="mx-auto mt-6 max-w-[34rem] text-[19px] leading-[1.5] text-label-2 lg:mx-0">
            GhostTrace checks GitHub repositories, their commit history and breach data for exposed passwords, API keys and tokens, then uses AI to tell you which ones are real and which to fix first.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link to={cta} className="press inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-callout font-semibold text-black hover:bg-[#e6e6e6]">Scan a repository <ArrowRight className="h-4 w-4" /></Link>
            <a href="#how" className="press inline-flex h-12 items-center rounded-full bg-[#1e1e1e] px-7 text-callout font-semibold text-white hover:bg-[#2a2a2a]">How it works</a>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-footnote text-label-3 lg:justify-start"><Lock className="h-3.5 w-3.5" /> Secrets are masked. The raw value is never stored.</p>
        </motion.div>
        <motion.div
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.1 }}
        >
          <div className="glass rounded-sheet p-4">
            <div className="pb-3 pt-4 text-center">
              <div className="text-footnote font-medium text-white/80">Thursday 22 October</div>
              <div className="text-[64px] font-semibold leading-none tracking-tight text-white/95">9:41</div>
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {feed.map((n) => (
                  <motion.div
                    key={n.title} layout
                    initial={{ opacity: 0, y: -30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }}
                  >
                    <Notification n={n} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-6">
        <h2 className="mx-auto max-w-2xl text-center text-[34px] font-bold leading-tight tracking-[-0.02em] text-label sm:text-[44px]">From pasted link to rotated key in three steps.</h2>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon, color, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
              transition={{ type: 'spring', stiffness: 200, damping: 26, delay: i * 0.08 }}
              className="glass h-full rounded-group p-6"
            >
              <div className="flex items-center justify-between">
                <IconTile icon={icon} color={color} className="h-11 w-11 rounded-[12px] [&>svg]:h-6 [&>svg]:w-6" />
                <span className="text-title2 tabular-nums text-label-4">{i + 1}</span>
              </div>
              <h3 className="mt-5 text-title3 text-label">{title}</h3>
              <p className="mt-2 text-callout leading-relaxed text-label-2">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section id="finds" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl text-[34px] font-bold leading-tight tracking-[-0.02em] text-label sm:text-[44px]">Knows what a real key looks like.</h2>
        <p className="mx-auto mt-4 max-w-xl text-callout leading-relaxed text-label-2">Provider-specific patterns catch known formats precisely. Randomness analysis and the AI model catch the rest, and stay quiet about placeholders and test fixtures.</p>
        <motion.div
          className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-[28px] bg-[#101010] text-left"
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
          transition={{ type: 'spring', stiffness: 160, damping: 24 }}
        >
          <div className="flex items-center gap-2 px-5 py-4">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" /><span className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" /><span className="h-2.5 w-2.5 rounded-full bg-[#2a2a2a]" />
            <span className="ml-3 font-mono text-caption text-label-3">deploy/.env</span>
          </div>
          <div className="pb-3">
            {SAMPLE.map((s, i) => (
              <div key={s.code} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="w-3 shrink-0 text-right font-mono text-caption text-label-4">{i + 1}</span>
                  <span className="truncate font-mono text-footnote text-label">{s.code}</span>
                </div>
                <span className="inline-flex h-7 w-fit shrink-0 items-center gap-2 rounded-full bg-[#1e1e1e] px-3 text-caption font-medium text-label-2">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />{s.verdict}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
        <div className="mx-auto mt-14 grid max-w-3xl gap-8 sm:grid-cols-3">
          {[[GitCommitHorizontal, 'Git history', 'Deleted is not gone'], [MailWarning, 'Breach checks', 'Emails and passwords'], [FileDown, 'Reports', 'PDF and CSV']].map(([Icon, a, b]) => (
            <div key={a} className="flex flex-col items-center">
              <Icon className="h-6 w-6 text-label" />
              <div className="mt-3 text-subhead font-semibold text-label">{a}</div>
              <div className="mt-0.5 text-footnote text-label-3">{b}</div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 flex max-w-3xl flex-wrap justify-center gap-2">
          {DETECTORS.map((d, i) => (
            <motion.span
              key={d} className="rounded-full bg-[#161616] px-3.5 py-1.5 text-footnote text-label-2"
              initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              transition={{ delay: i * 0.02, type: 'spring', stiffness: 400, damping: 26 }}
            >{d}</motion.span>
          ))}
        </div>
      </section>

      <section id="privacy" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 text-center sm:px-6">
        <h2 className="text-title1 text-label">Built so it can’t leak what it finds.</h2>
        <p className="mx-auto mt-2 max-w-2xl text-callout leading-relaxed text-label-2">GhostTrace keeps a masked preview and a SHA-256 fingerprint of each secret, never the secret itself. Password checks use k-anonymity, so only the first five characters of a hash ever leave the server.</p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 pt-8 text-center sm:px-6">
        <GhostMark className="mx-auto h-20 w-20 drop-shadow-[0_10px_24px_rgba(255,255,255,0.15)]" />
        <h2 className="mt-6 text-[34px] font-bold tracking-[-0.02em] text-label sm:text-[44px]">See what’s already public.</h2>
        <p className="mx-auto mt-3 max-w-md text-callout text-label-2">Your first scan takes about a minute.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to={cta} className="press inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-callout font-semibold text-black hover:bg-[#e6e6e6]"><ScanSearch className="h-4 w-4" /> Start scanning</Link>
          {!user && <Link to="/login" className="press inline-flex h-12 items-center rounded-full bg-[#1e1e1e] px-7 text-callout font-semibold text-white hover:bg-[#2a2a2a]">Sign in</Link>}
        </div>
      </section>

      <footer className="hairline-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center text-footnote text-label-3 sm:px-6">
          <div className="flex items-center gap-2"><GhostMark className="h-5 w-5" /> GhostTrace</div>
          <p>Built by Tanmay Dabholkar, Shirshak Dange, Aayush Doke and Atharva Goim.</p>
          <p className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Only scan code you own or are authorized to test.</p>
        </div>
      </footer>
    </div>
  )
}
