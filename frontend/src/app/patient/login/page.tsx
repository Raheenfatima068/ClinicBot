
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let data: unknown = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        let errorMessage =
          "Login failed. Please check your email and password.";

        if (typeof data === "object" && data !== null) {
          const errorData = data as {
            detail?: unknown;
            message?: unknown;
          };

          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail;
          } else if (typeof errorData.message === "string") {
            errorMessage = errorData.message;
          }
        } else if (typeof data === "string") {
          errorMessage = data;
        }

        throw new Error(errorMessage);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("access_token" in data)
      ) {
        throw new Error(
          "Login succeeded, but no access token was returned."
        );
      }

      const accessToken = (data as { access_token?: unknown })
        .access_token;

      if (typeof accessToken !== "string" || !accessToken) {
        throw new Error(
          "Login succeeded, but the access token is invalid."
        );
      }

      localStorage.setItem(
        "patient_access_token",
        accessToken
      );

      router.push("/patient/intake");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else if (typeof err === "string") {
        setError(err);
      } else {
        setError(
          "Unable to connect to ClinicBot. Please make sure the backend server is running."
        );
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

            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center rounded-full border border-teal-400/20 bg-teal-400/10 px-4 py-2 text-sm font-medium text-teal-300">
                Patient Portal
              </div>

              <h2 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
                Prepare before your
                <span className="mt-2 block text-teal-300">
                  consultation.
                </span>
              </h2>

              <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
                Sign in to continue your pre-consultation intake
                and provide your doctor with organized information
                about your health concerns.
              </p>

              <div className="mt-10 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-teal-300">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      Easy Intake
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Answer simple questions about your current
                      health concern.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-teal-300">
                    ✓
                  </div>

                  <div>
                    <h3 className="font-semibold text-white">
                      Organized Information
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Your responses are structured for clinical
                      review.
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
                      Your information is reviewed by your
                      healthcare professional.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-500">
              © 2026 ClinicBot · Clinical Intake & Documentation
              Portal
            </div>
          </div>
        </section>

        {/* Login Form */}
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

            <div className="mb-8">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-600">
                Patient Portal
              </p>

              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in to continue your pre-consultation intake.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-8">
              <form onSubmit={handleLogin} className="space-y-6">
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
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
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
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
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

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In to Patient Portal"
                  )}
                </button>
              </form>

              {/* Register Link */}
              <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                <p className="text-sm text-slate-500">
                  New to ClinicBot?
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/patient/register")
                  }
                  className="mt-2 text-sm font-semibold text-teal-600 transition hover:text-teal-700"
                >
                  Create a patient account →
                </button>
              </div>
            </div>

            {/* Disclaimer */}
            <p className="mt-6 text-center text-xs leading-5 text-slate-400">
              ClinicBot provides AI-assisted documentation and
              does not replace professional clinical judgment.
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

