"use client";

import { useRouter } from "next/navigation";

export default function PatientAccessPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-bold text-white shadow-sm">
              C
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                ClinicBot
              </h1>
              <p className="text-xs text-slate-500">
                Clinical Intake Agent
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-slate-600">
              Patient Portal
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="relative flex min-h-[calc(100vh-145px)] items-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.12),_transparent_35%)]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-16 sm:px-8 lg:py-20">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            {/* Introduction */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                Pre-Consultation Patient Portal
              </div>

              <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Prepare for your
                <span className="block text-teal-600">
                  doctor consultation.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                ClinicBot collects your basic health information before your
                appointment and organizes it into a concise clinical summary
                for your doctor to review.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Simple
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Easy questions about your health.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Secure
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Your account identifies your intake.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Doctor Reviewed
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Information is reviewed by your doctor.
                  </p>
                </div>
              </div>
            </div>

            {/* Access Card */}
            <div className="mx-auto w-full max-w-md">
              <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                    Patient Access
                  </p>

                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                    How would you like to continue?
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Sign in if you already have an account, or create a new
                    patient account to begin.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Returning Patient */}
                  <button
                    type="button"
                    onClick={() => router.push("/patient/login")}
                    className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                        →
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          Returning Patient
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Sign in to continue your intake.
                        </p>
                      </div>
                    </div>

                    <span className="text-xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-600">
                      →
                    </span>
                  </button>

                  {/* New Patient */}
                  <button
                    type="button"
                    onClick={() => router.push("/patient/register")}
                    className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">
                        +
                      </div>

                      <div>
                        <p className="font-semibold text-slate-900">
                          New Patient
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Create your patient account.
                        </p>
                      </div>
                    </div>

                    <span className="text-xl text-slate-400 transition group-hover:translate-x-1 group-hover:text-teal-600">
                      →
                    </span>
                  </button>
                </div>

                {/* Notice */}
                <div className="mt-7 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <span className="mt-0.5 text-amber-600">ⓘ</span>

                    <p className="text-xs leading-5 text-amber-800">
                      ClinicBot assists with patient intake and clinical
                      documentation. It does not diagnose conditions or
                      prescribe treatment.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>Secure access</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>Doctor reviewed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto px-6 py-5 text-center text-xs text-slate-400 sm:px-8">
          © 2026 ClinicBot · Clinical Intake & Documentation Portal
        </div>
      </footer>
    </main>
  );
}