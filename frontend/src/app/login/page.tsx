"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type UserResponse = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

export default function LoginPage() {
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
      // Step 1: Login
      const loginResponse = await fetch(
        "http://127.0.0.1:8000/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(
          loginData.detail ||
            "Login failed. Please check your credentials."
        );
      }

      // Save JWT
      localStorage.setItem(
        "access_token",
        loginData.access_token
      );

      // Step 2: Get logged-in user's role
      const meResponse = await fetch(
        "http://127.0.0.1:8000/auth/me",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${loginData.access_token}`,
          },
        }
      );

      const userData: UserResponse = await meResponse.json();

      if (!meResponse.ok) {
        throw new Error(
          "Login succeeded, but user information could not be loaded."
        );
      }

      // Step 3: Redirect according to role
      if (userData.role === "admin") {
        router.push("/admin");
      } else if (userData.role === "doctor") {
        router.push("/");
      } else if (userData.role === "patient") {
        router.push("/patient/intake");
      } else {
        throw new Error(
          "Unknown user role. Please contact the administrator."
        );
      }
    } catch (err) {
      localStorage.removeItem("access_token");

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong during login.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500 text-xl font-bold text-white">
            C
          </div>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            ClinicBot
          </h1>

          <p className="mt-2 text-slate-500">
            Secure Portal Login
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Admin, Doctor & Patient Access
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleLogin}
          className="space-y-5"
        >
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
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
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs leading-5 text-slate-400">
            Your account role determines which ClinicBot
            workspace you can access.
          </p>
        </div>
      </div>
    </main>
  );
}