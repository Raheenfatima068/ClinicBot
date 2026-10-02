
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Registration failed. Please try again."
        );
      }

      setSuccess(
        "Your patient account has been created successfully. Redirecting to login..."
      );

      setTimeout(() => {
        router.push("/patient/login");
      }, 1500);
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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* Branding Panel */}
        <section className="relative hidden overflow-hidden bg-slate-900 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(45,212,191,0.18),_transparent_45%)]" />

          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 xl:p-16">

            {/* Logo */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400 text-xl font-bold text-slate-900 shadow-lg">
                  C
                </div>

                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">
                    ClinicBot
                  </h1>

                  <p className="text-xs text-slate-400">
                    Clinical Intake Agent
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="max-w-xl">

              <div className="mb-6 inline-flex items-center rounded-full border border-teal-400/20 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-300">
                Patient Portal
              </div>

              <h2 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Start your
                <span className="mt-2 block text-teal-300">
                  pre-consultation.
                </span>
              </h2>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                Create your ClinicBot patient account and provide your
                healthcare team with organized information before your
                consultation.
              </p>

              {/* Features */}
              <div className="mt-10 space-y-5">

                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-teal-300">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      Simple Registration
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Create your patient account in just a few steps.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-teal-300">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      Guided Intake
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Answer simple questions about your health concern.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-teal-300">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      Doctor Review
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Your information can be reviewed by your healthcare
                      professional.
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="text-sm text-slate-500">
              © 2026 ClinicBot · Clinical Intake & Documentation Portal
            </div>
          </div>
        </section>

        {/* Registration Form */}
        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-16">

          <div className="w-full max-w-md">

            {/* Mobile Branding */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-xl font-bold text-white">
                C
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  ClinicBot
                </h1>

                <p className="text-xs text-slate-500">
                  Clinical Intake Agent
                </p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-600">
                Patient Portal
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Create your account
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Register to begin your pre-consultation intake.
              </p>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-8">

              <form onSubmit={handleRegister} className="space-y-5">

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Full name
                  </label>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />

                  <p className="mt-2 text-xs text-slate-400">
                    Use at least 6 characters.
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                      !
                    </div>

                    <p className="text-sm leading-5 text-red-700">
                      {error}
                    </p>
                  </div>
                )}

                {/* Success */}
                {success && (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">
                      ✓
                    </div>

                    <p className="text-sm leading-5 text-emerald-700">
                      {success}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating account...
                    </span>
                  ) : (
                    "Create Patient Account"
                  )}
                </button>

              </form>

              {/* Login Link */}
              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  Already have an account?
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/patient/login")}
                  className="mt-2 text-sm font-semibold text-teal-600 transition hover:text-teal-700"
                >
                  Sign in to Patient Portal →
                </button>
              </div>

            </div>

            {/* Disclaimer */}
            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              ClinicBot provides AI-assisted documentation and does not
              replace professional clinical judgment.
            </p>

            {/* Back */}
            <button
              type="button"
              onClick={() => router.push("/patient")}
              className="mx-auto mt-5 block text-xs font-medium text-slate-400 transition hover:text-slate-600"
            >
              ← Back to Patient Portal
            </button>

          </div>
        </section>
      </div>
    </main>
  );
}

