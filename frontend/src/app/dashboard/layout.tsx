'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isOverview = pathname === '/dashboard';
  const isCalendar = pathname === '/dashboard/calendar';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Admin Navigation Bar */}
      <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand & Badge */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 group">
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600 group-hover:text-indigo-700">
                  GoPratle
                </span>
                <span className="text-slate-400">/</span>
                <span className="text-sm font-semibold text-slate-800">Admin</span>
              </Link>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                MVP (Auth-free)
              </span>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/dashboard"
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
                  isOverview
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Overview
              </Link>
              <Link
                href="/dashboard/calendar"
                className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${
                  isCalendar
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                Calendar
              </Link>
              <span className="h-4 w-px bg-slate-200 mx-1 sm:mx-2" />
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600"
              >
                <span>+</span> Post Brief
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
