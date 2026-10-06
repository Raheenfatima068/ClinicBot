"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminDashboardResponse = {
  message: string;
  admin: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  statistics: {
    total_users: number;
    total_patients: number;
    total_doctors: number;
    total_admins: number;
  };
};

export default function AdminDashboard() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<AdminDashboardResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  async function fetchDashboard() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/admin/dashboard",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        router.push("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to load admin dashboard."
        );
      }

      setDashboard(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to connect to ClinicBot.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function logout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  async function handleRefresh() {
    await fetchDashboard();

    setShowSuccessToast(true);

    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  }

  return (
    <>
      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl shadow-slate-900/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                Dashboard refreshed
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Latest system statistics have been loaded.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuccessToast(false)}
              className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close notification"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50 text-slate-900">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-950 lg:flex lg:flex-col">
          {/* Logo */}
          <div className="flex h-20 items-center border-b border-slate-800 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-lg font-bold text-slate-950">
              C
            </div>

            <div className="ml-3">
              <h1 className="text-lg font-bold text-white">
                ClinicBot
              </h1>

              <p className="text-[11px] text-slate-500">
                Clinical Intake Agent
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              Administration
            </p>

            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl bg-teal-400/10 px-3 py-3 text-sm font-semibold text-teal-300"
            >
              <span className="text-lg">▦</span>
              Dashboard
            </button>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Access Level
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                Administrator
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Full system administration access.
              </p>
            </div>
          </nav>

          {/* Admin Profile */}
          <div className="border-t border-slate-800 p-4">
            <div className="mb-3 rounded-xl bg-slate-900 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-slate-950">
                  {dashboard
                    ? getInitials(dashboard.admin.name)
                    : "AD"}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {dashboard?.admin.name || "Administrator"}
                  </p>

                  <p className="text-xs text-slate-500">
                    System Admin
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <span>↪</span>
              Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="lg:pl-64">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex h-20 items-center justify-between px-5 sm:px-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                  Administration Portal
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Admin Dashboard
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Mobile menu */}
                <button
                  type="button"
                  onClick={() =>
                    setMobileMenuOpen(!mobileMenuOpen)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                  aria-label={
                    mobileMenuOpen
                      ? "Close navigation menu"
                      : "Open navigation menu"
                  }
                  aria-expanded={mobileMenuOpen}
                >
                  <span className="text-xl">
                    {mobileMenuOpen ? "×" : "☰"}
                  </span>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:block"
                >
                  ↻ Refresh
                </button>

                <div className="hidden h-8 w-px bg-slate-200 sm:block" />

                {/* Admin avatar */}
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {dashboard
                      ? getInitials(dashboard.admin.name)
                      : "AD"}
                  </div>

                  <div className="hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900">
                      {dashboard?.admin.name || "Administrator"}
                    </p>

                    <p className="text-xs text-slate-500">
                      Authorized Admin
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
              <nav
                aria-label="Mobile navigation"
                className="space-y-2"
              >
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full rounded-xl bg-teal-50 px-4 py-3 text-left text-sm font-semibold text-teal-700"
                >
                  Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRefresh();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Refresh Dashboard
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Sign out
                </button>
              </nav>
            </div>
          )}

          {/* Content */}
          <main className="px-5 py-8 sm:px-8">
            {/* Welcome */}
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
                System administration
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Welcome,{" "}
                {dashboard?.admin.name || "Administrator"}
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Monitor ClinicBot users and system-level
                account statistics from the administration
                workspace.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 font-bold text-red-600">
                    !
                  </div>

                  <div>
                    <p className="text-sm font-bold text-red-800">
                      Unable to load dashboard
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && !dashboard ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />

                  <p className="mt-4 text-sm text-slate-500">
                    Loading administration dashboard...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Statistics */}
                <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {/* Total Users */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Total Users
                        </p>

                        <p className="mt-3 text-3xl font-bold text-slate-900">
                          {dashboard?.statistics.total_users ?? 0}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          All registered accounts
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg">
                        👥
                      </div>
                    </div>
                  </div>

                  {/* Patients */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Patients
                        </p>

                        <p className="mt-3 text-3xl font-bold text-teal-600">
                          {dashboard?.statistics.total_patients ?? 0}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          Registered patient accounts
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-lg">
                        ♙
                      </div>
                    </div>
                  </div>

                  {/* Doctors */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Doctors
                        </p>

                        <p className="mt-3 text-3xl font-bold text-blue-600">
                          {dashboard?.statistics.total_doctors ?? 0}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          Authorized doctor accounts
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg">
                        ⚕
                      </div>
                    </div>
                  </div>

                  {/* Admins */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Administrators
                        </p>

                        <p className="mt-3 text-3xl font-bold text-emerald-600">
                          {dashboard?.statistics.total_admins ?? 0}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          System administrator accounts
                        </p>
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg">
                        🛡
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Information */}
                <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                      Administrator account
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-slate-900">
                      Account Information
                    </h2>
                  </div>

                  <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Name
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {dashboard?.admin.name ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Email
                      </p>

                      <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                        {dashboard?.admin.email ||
                          "Not available"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        User ID
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {dashboard?.admin.id ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50 p-4">
                      <p className="text-xs text-emerald-600">
                        Access Role
                      </p>

                      <p className="mt-1 text-sm font-bold capitalize text-emerald-700">
                        {dashboard?.admin.role ||
                          "admin"}
                      </p>
                    </div>
                  </div>
                </section>

                {/* System Overview */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                        System overview
                      </p>

                      <h2 className="mt-1 text-lg font-bold text-slate-900">
                        ClinicBot Administration
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Current account distribution across
                        the ClinicBot platform.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                          Patient access
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Patients can register, authenticate,
                          and complete pre-consultation intake
                          sessions.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                          Doctor access
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Doctors can review patient intake
                          information and AI-assisted clinical
                          summaries.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                          Admin access
                        </p>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Administrators have protected access
                          to system-level account statistics.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Mobile Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh Dashboard"}
            </button>

            {/* Footer */}
            <footer className="mt-8 pb-4 text-center">
              <p className="text-xs text-slate-400">
                ClinicBot · Administration Portal
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Protected administrator workspace.
              </p>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
