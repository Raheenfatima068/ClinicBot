
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8001/auth/password-reset/request",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to process your request. Please try again."
        );
      }

      setMessage(
        "If this email is registered, password-reset instructions will be available. For local development, check the backend terminal for the reset link."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to ClinicBot. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-2xl font-bold text-teal-700">
            C
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Forgot Password?
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter your registered email address to begin resetting your
            ClinicBot password.
          </p>
        </div>

        {message && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Processing..." : "Request Password Reset"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/patient/login"
            className="text-sm font-medium text-teal-700 hover:text-teal-900 hover:underline"
          >
            ← Back to Patient Login
          </Link>
        </div>

        <p className="mt-7 text-center text-xs text-slate-500">
          ClinicBot · Clinical Intake Agent
        </p>
      </section>
    </main>
  );
}
