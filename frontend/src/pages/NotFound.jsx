import { Link } from 'react-router-dom'
import { GhostMark } from '../components/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <GhostMark className="h-14 w-14" />
      <h1 className="mt-6 text-3xl font-bold text-white">Nothing to trace here</h1>
      <p className="mt-2 text-ink-300">The page you are looking for does not exist.</p>
      <Link to="/" className="mt-6 rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-ink-950">Back home</Link>
    </div>
  )
}
