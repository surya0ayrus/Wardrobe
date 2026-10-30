import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="py-20 text-center">
      <p className="text-5xl font-semibold text-accent">404</p>
      <p className="mt-2 font-medium">Page not found</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary-ink hover:underline">Back to dashboard</Link>
    </div>
  )
}
