import { Link } from 'react-router-dom'
import {
  ArrowRight, Brain, Database, FileSearch, KeyRound, LineChart, Mail, Radar,
  ShieldCheck, Sparkles, TerminalSquare, Zap, BellRing, FileDown, Eye,
} from 'lucide-react'
import { Github } from '../components/icons'
import Logo from '../components/Logo'
import { useAuth } from '../lib/auth'
import { useSmoothScroll } from '../lib/smoothScroll'
import AnimatedContent from '../components/reactbits/AnimatedContent'
import CountUp from '../components/reactbits/CountUp'
import DecryptedText from '../components/reactbits/DecryptedText'
import LetterGlitch from '../components/reactbits/LetterGlitch'
import ShinyText from '../components/reactbits/ShinyText'
import SpotlightCard from '../components/reactbits/SpotlightCard'
import StarBorder from '../components/reactbits/StarBorder'

const PIPELINE = [
  { icon: Github, title: 'Public sources', text: 'GitHub users, orgs and repos, including commit history, plus pasted text and uploaded files.' },
  { icon: Radar, title: 'Collection', text: 'Repository trees and diffs are pulled through the GitHub API and streamed to the engine.' },
  { icon: FileSearch, title: 'Detection', text: '40+ provider-specific rules plus Shannon-entropy analysis for unknown secrets.' },
  { icon: Brain, title: 'AI risk scoring', text: 'A trained model estimates whether each hit is a live secret and scores its blast radius.' },
  { icon: Database, title: 'Central store', text: 'Findings are de-duplicated by fingerprint. Raw secrets are never stored.' },
  { icon: LineChart, title: 'Dashboard', text: 'Trends, exposure timeline, search by org or user, and triage workflow.' },
  { icon: BellRing, title: 'Alerts', text: 'Email alerts the moment a monitored target leaks something above your threshold.' },
]

const DETECTORS = [
  'AWS access keys', 'GitHub tokens', 'Google API keys', 'Stripe secrets', 'Slack tokens', 'JWTs',
  'SSH & PEM private keys', 'Database URLs', 'Hard-coded passwords', 'OpenAI & Anthropic keys',
  'Twilio, SendGrid, Mailgun', 'Azure & GCP credentials', 'npm & PyPI tokens', 'Email addresses',
]

const FEATURES = [
  { icon: KeyRound, title: 'Credential detection', items: ['Passwords and connection strings', 'API keys for 30+ providers', 'JWT, AWS, SSH and PEM keys', 'Leaked email addresses'] },
  { icon: Sparkles, title: 'AI features', items: ['Probability a hit is a real secret', 'Risk score from 0 to 100', 'Placeholder and test-file suppression', 'Prioritized threat queue'] },
  { icon: Eye, title: 'For your team', items: ['Continuous monitoring of targets', 'Breach lookups for emails', 'Exposure timeline and trends', 'Downloadable PDF and CSV reports'] },
]

function TerminalMock() {
  const lines = [
    { c: 'text-ink-400', t: '$ ghosttrace scan --org acme-corp --history' },
    { c: 'text-ink-300', t: '→ 27 repositories · 3,412 files · 1,080 commits' },
    { c: 'text-sev-critical', t: '■ CRITICAL  aws_access_key   infra/deploy.sh:14        risk 96' },
    { c: 'text-sev-high', t: '■ HIGH      github_pat       .github/scripts/sync.py   risk 84' },
    { c: 'text-sev-high', t: '■ HIGH      postgres_url     api/.env.production       risk 79' },
    { c: 'text-sev-medium', t: '■ MEDIUM    jwt              tests/fixtures/auth.json  risk 41' },
    { c: 'text-sev-low', t: '■ LOW       email            README.md                 risk 12' },
    { c: 'text-cyan', t: '✓ 5 findings · alert sent to security@acme-corp.dev' },
  ]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/90 shadow-glow">
      <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-sev-critical/70" />
        <span className="h-3 w-3 rounded-full bg-sev-medium/70" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
        <span className="ml-3 font-mono text-xs text-ink-400">ghosttrace — exposure scan</span>
      </div>
      <div className="relative space-y-1.5 overflow-x-auto p-5 font-mono text-[12px] leading-relaxed sm:text-[13px]">
        {lines.map((l, i) => (
          <div key={i} className={`${l.c} whitespace-pre opacity-0 [animation:fadeIn_.4s_ease_forwards]`} style={{ animationDelay: `${i * 0.35}s` }}>
            {l.t}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-cyan/5 to-transparent animate-scan" />
      </div>
      <style>{'@keyframes fadeIn{to{opacity:1}}'}</style>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  useSmoothScroll()
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-ink-800/60 bg-ink-950/75 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-ink-300 md:flex">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#detectors" className="hover:text-white">Detectors</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className="inline-flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-500">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="rounded-lg px-3 py-2 text-sm text-ink-200 hover:text-white">Sign in</Link>
                <Link to="/register" className="inline-flex items-center gap-2 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-cyan-500">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]">
          <LetterGlitch glitchColors={['#0b1628', '#22d3ee', '#2f7bff']} glitchSpeed={60} outerVignette={false} backgroundColor="#050a14" />
        </div>
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-signal/20 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div>
            <div className="mb-5"><ShinyText text="AI × CYBERSECURITY" className="eyebrow" color="#22d3ee" shineColor="#ffffff" speed={3} /></div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find leaked credentials <span className="bg-gradient-to-r from-cyan to-signal bg-clip-text text-transparent">
                <DecryptedText text="before attackers do." animateOn="view" speed={45} maxIterations={14} sequential revealDirection="start" />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-300">
              GhostTrace scans GitHub, breach data and pasted content for exposed passwords, API keys, tokens and private keys,
              then uses AI to score what is real and what is urgent.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <StarBorder as={Link} to={user ? '/app/scans' : '/register'} color="#22d3ee" radius={8} duration={3.5} backgroundColor="#22d3ee" textColor="#050a14" className="inline-flex items-center gap-2 px-6 py-3 font-semibold">
                Run your first scan <ArrowRight className="h-4 w-4" />
              </StarBorder>
              <a href="#how" className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-6 py-3 font-medium text-ink-100 hover:border-ink-500 hover:bg-ink-800/60">
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-xs uppercase tracking-wider text-ink-400">
              <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan" /> Secrets never stored</span>
              <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-cyan" /> Minutes, not months</span>
              <span className="flex items-center gap-2"><TerminalSquare className="h-4 w-4 text-cyan" /> Full commit history</span>
            </div>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-4">
              {[[49, '+', 'detection rules'], [30, '+', 'providers'], [100, '', 'point risk score']].map(([n, suf, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold tabular-nums text-white"><CountUp to={n} duration={2} />{suf}</dt>
                  <dd className="mt-0.5 text-xs text-ink-400">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <TerminalMock />
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <div className="eyebrow mb-3">The risk</div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Leaks are usually found after someone has already used them.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['Developers push secrets to GitHub', 'A single committed .env lives forever in git history, even after it is deleted.'],
              ['Organizations stay unaware', 'Most teams have no continuous view of what their people expose in public.'],
              ['Existing tools react late', 'Breach notifications arrive after the data has already been sold or exploited.'],
              ['Alert overload', 'Keyword scanners flood teams with test keys and placeholders, so real leaks get missed.'],
            ].map(([t, d], i) => (
              <AnimatedContent key={t} distance={40} delay={i * 0.08}>
                <SpotlightCard spotlightColor="#e0377f" className="h-full p-5">
                  <div className="mb-2 h-1 w-8 rounded-full bg-magenta" />
                  <h3 className="font-semibold text-white">{t}</h3>
                  <p className="mt-1.5 text-sm text-ink-300">{d}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow mb-3">How it works</div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">A continuous intelligence pipeline for credential exposure</h2>
        </div>
        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className={`group relative rounded-xl border border-ink-800 bg-ink-900/70 p-5 transition hover:border-cyan/40 ${i === 3 ? 'lg:row-span-1 border-signal/50 bg-signal/10' : ''}`}>
              <div className="mb-4 flex items-center justify-between">
                <Icon className="h-5 w-5 text-cyan" />
                <span className="font-mono text-xs text-ink-500">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-1.5 text-sm text-ink-300">{text}</p>
            </li>
          ))}
          <li className="flex flex-col justify-between rounded-xl border border-cyan/30 bg-gradient-to-br from-cyan/15 to-transparent p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-cyan">Early detection + intelligent prioritization</p>
            <Link to={user ? '/app/scans' : '/register'} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan">
              Start scanning <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <div className="eyebrow mb-3">Capabilities</div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything a security team needs to stop the chain early</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, items }, i) => (
              <AnimatedContent key={title} distance={50} delay={i * 0.1}>
              <SpotlightCard spotlightColor="#22d3ee" className="h-full p-6">
                <div className="mb-5 inline-flex rounded-lg border border-cyan/30 bg-cyan/10 p-2.5">
                  <Icon className="h-5 w-5 text-cyan" />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-ink-300">
                  {items.map((it) => (
                    <li key={it} className="flex gap-2.5"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan" />{it}</li>
                  ))}
                </ul>
              </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* Detectors */}
      <section id="detectors" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="eyebrow mb-3">Detectors</div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Knows what a real key looks like</h2>
            <p className="mt-4 text-ink-300">
              Provider-specific patterns catch known formats with high precision. Entropy analysis and the AI model catch the rest,
              while suppressing placeholders like <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-cyan">YOUR_API_KEY</code> and test fixtures.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                [Mail, 'Breach intel', 'Live email breach lookups'],
                [FileDown, 'Reports', 'PDF and CSV exports'],
                [Eye, 'Monitors', 'Scheduled re-scans'],
              ].map(([Icon, t, d]) => (
                <div key={t} className="rounded-xl border border-ink-800 bg-ink-900/70 p-4">
                  <Icon className="mb-3 h-4 w-4 text-cyan" />
                  <div className="text-sm font-semibold text-white">{t}</div>
                  <div className="mt-1 text-xs text-ink-400">{d}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {DETECTORS.map((d) => (
              <span key={d} className="rounded-full border border-ink-700 bg-ink-900 px-4 py-2 font-mono text-xs text-ink-200">{d}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-cyan/30 bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 px-8 py-16 text-center">
          <div className="grid-bg absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Detect early. Stop the chain.</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-300">Point GhostTrace at your GitHub organization and see what is already public.</p>
            <Link to={user ? '/app/scans' : '/register'} className="mt-8 inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3 font-semibold text-ink-950 shadow-glow hover:bg-cyan-500">
              Create a free account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Built by Tanmay Dabholkar, Shirshak Dange, Aayush Doke and Atharva Goim.</p>
          <p className="font-mono text-xs uppercase tracking-wider">GhostTrace / Exposure Intelligence</p>
        </div>
      </footer>
    </div>
  )
}
