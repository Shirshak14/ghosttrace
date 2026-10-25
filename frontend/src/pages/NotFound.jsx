import { Link } from 'react-router-dom'
import { GhostMark } from '../components/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <GhostMark className="h-14 w-14" />
      <h1 className="mt-6 text-title1 text-label">Nothing to trace here</h1>
      <p className="mt-2 text-callout text-label-2">The page you are looking for does not exist.</p>
      <Link to="/" className="press mt-6 inline-flex h-11 items-center rounded-full bg-white px-6 text-callout font-semibold text-black">Back home</Link>
    </div>
  )
}
