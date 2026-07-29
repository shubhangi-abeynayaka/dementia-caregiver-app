import { Link } from 'react-router-dom'

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4">
      <div className="max-w-xl text-center rounded-3xl border border-slate-200 bg-white p-10 shadow-lg">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="mt-4 text-xl font-semibold">Page not found</p>
        <p className="mt-2 text-slate-600">The page you are looking for does not exist or has been moved.</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          Go back home
        </Link>
      </div>
    </div>
  )
}
