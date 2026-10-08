import Logo from '../components/Logo'

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-ink-800 bg-ink-900 lg:block">
        <div className="grid-bg absolute inset-0" />
        <div className="absolute -left-20 top-1/3 h-96 w-96 rounded-full bg-signal/25 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-cyan/15 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <div className="eyebrow mb-4">Exposure intelligence</div>
            <p className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white">
              Credentials are the keys to your infrastructure. Know the moment one goes public.
            </p>
            <div className="mt-10 grid max-w-md grid-cols-3 gap-3 font-mono text-xs">
              {[['Detect', 'rules + AI'], ['Score', '0–100 risk'], ['Alert', 'email']].map(([a, b]) => (
                <div key={a} className="rounded-lg border border-ink-700 bg-ink-950/50 p-3">
                  <div className="text-cyan">{a}</div>
                  <div className="mt-1 text-ink-400">{b}</div>
                </div>
              ))}
            </div>
          </div>
          <p className="font-mono text-xs uppercase tracking-wider text-ink-500">GhostTrace / Exposure Intelligence</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-300">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-400">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
