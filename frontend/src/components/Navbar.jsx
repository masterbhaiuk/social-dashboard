import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { useAdminAuth } from '../hooks/useAdminAuth'

export default function Navbar() {
  const { isAdmin, logout } = useAdminAuth()

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
            S
          </span>
          <span className="text-base font-semibold tracking-tight">Social Pulse</span>
        </Link>

        <nav className="flex items-center gap-3">
          <ThemeToggle />
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Admin Panel
              </Link>
              <button
                onClick={logout}
                className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              to="/admin"
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
