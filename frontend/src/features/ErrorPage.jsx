import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/Button'


export default function ErrorPage() {
  const error = useRouteError()
  // The router catches the error to show this page, so it never reaches the console by itself.
  useEffect(() => { if (error) console.error(error) }, [error])
  const notFound = isRouteErrorResponse(error) && error.status === 404
  const failedLoad = /dynamically imported module|importing a module script/i.test(error?.message ?? '')

  return (
    <div className="px-4 py-20 text-center">
      <p className="text-5xl font-semibold text-accent">{notFound ? '404' : 'Oops'}</p>
      <p className="mt-2 font-medium">{notFound ? 'Page not found' : 'Something went wrong'}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {failedLoad ? 'This page could not be loaded. Reload to get the latest version.' : 'An unexpected error occurred. Try reloading the page; if it keeps happening, contact support.'}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Link to="/" reloadDocument className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-primary-ink hover:underline">Back to dashboard</Link>
      </div>
      {import.meta.env.DEV && error && (
        <details className="mx-auto mt-8 max-w-2xl text-left">
          <summary className="cursor-pointer text-xs text-muted">Error details</summary>
          <pre className="mt-2 overflow-auto rounded-md bg-surface p-3 text-xs whitespace-pre-wrap">{error.stack ?? error.message ?? String(error.statusText ?? error)}</pre>
        </details>
      )}
    </div>
  )
}
