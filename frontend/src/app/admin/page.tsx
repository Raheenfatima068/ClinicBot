
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";

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

type Doctor = {
  id: number;
  full_name: string;
  email: string;
  specialty: string | null;
  role: string;
};

const SPECIALTIES = [
  "General Medicine",
  "Neurology",
  "Cardiology",
  "Dermatology",
  "Respiratory Medicine",
  "Gastroenterology",
  "Orthopedics",
];

export default function AdminDashboard() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<AdminDashboardResponse | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [error, setError] = useState("");
  const [doctorError, setDoctorError] = useState("");
  const [doctorSuccess, setDoctorSuccess] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const [doctorName, setDoctorName] = useState("");
  const [doctorEmail, setDoctorEmail] = useState("");
  const [doctorPassword, setDoctorPassword] = useState("");
  const [doctorSpecialty, setDoctorSpecialty] =
    useState("General Medicine");

  const getToken = useCallback(() => {
    return localStorage.getItem("access_token");
  }, []);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    router.push("/login");
  }, [router]);

  const readResponse = async (response: Response) => {
    const text = await response.text();

    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { detail: text };
    }
  };

  const getErrorMessage = (data: unknown, fallback: string) => {
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;

      if (typeof detail === "string") return detail;

      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (
              item &&
              typeof item === "object" &&
              "msg" in item
            ) {
              return String(
                (item as { msg: unknown }).msg
              );
            }

            return String(item);
          })
          .join(", ");
      }
    }

    return fallback;
  };

  const fetchDashboard = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/admin/dashboard`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to load admin dashboard.")
        );
      }

      setDashboard(data as AdminDashboardResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to ClinicBot."
      );
    } finally {
      setLoading(false);
    }
  }, [getToken, handleUnauthorized, router]);

  const fetchDoctors = useCallback(async () => {
    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    setDoctorsLoading(true);
    setDoctorError("");

    try {
      const response = await fetch(
        `${API_URL}/admin/doctors`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to load registered doctors.")
        );
      }

      const result = data as { doctors?: Doctor[] };
      setDoctors(Array.isArray(result.doctors) ? result.doctors : []);
    } catch (err) {
      setDoctorError(
        err instanceof Error
          ? err.message
          : "Unable to connect to ClinicBot."
      );
    } finally {
      setDoctorsLoading(false);
    }
  }, [getToken, handleUnauthorized, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
      void fetchDoctors();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchDashboard, fetchDoctors]);

  async function handleAddDoctor(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setDoctorError("");
    setDoctorSuccess("");

    const token = getToken();

    if (!token) {
      router.push("/login");
      return;
    }

    const name = doctorName.trim();
    const email = doctorEmail.trim().toLowerCase();

    if (!name) {
      setDoctorError("Please enter the doctor's full name.");
      return;
    }

    if (!email.endsWith("@clinicbot.com")) {
      setDoctorError(
        "Doctor email must end with @clinicbot.com."
      );
      return;
    }

    if (doctorPassword.length < 12) {
      setDoctorError(
        "Password must contain at least 12 characters."
      );
      return;
    }

    if (!doctorSpecialty.trim()) {
      setDoctorError("Please select a specialty.");
      return;
    }

    setAddingDoctor(true);

    try {
      /*
       * Compatibility with the current backend:
       * POST /admin/doctors accepts query parameters.
       * For production, change the backend to accept a JSON body
       * so passwords are not included in request URLs.
       */
      const params = new URLSearchParams({
        full_name: name,
        email,
        password: doctorPassword,
        specialty: doctorSpecialty,
      });

      const response = await fetch(
        `${API_URL}/admin/doctors?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, "Unable to create doctor account.")
        );
      }

      setDoctorSuccess(
        `Doctor ${name} was added successfully.`
      );
      setDoctorName("");
      setDoctorEmail("");
      setDoctorPassword("");
      setDoctorSpecialty("General Medicine");

      await Promise.all([
        fetchDoctors(),
        fetchDashboard(),
      ]);
    } catch (err) {
      setDoctorError(
        err instanceof Error
          ? err.message
          : "Unable to connect to ClinicBot."
      );
    } finally {
      setAddingDoctor(false);
    }
  }

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
    await Promise.all([
      fetchDashboard(),
      fetchDoctors(),
    ]);

    setShowSuccessToast(true);

    window.setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {showSuccessToast && (
        <div
          className="fixed right-4 top-4 z-[100] max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 text-sm font-semibold text-emerald-700 shadow-xl"
          role="status"
        >
          Dashboard refreshed successfully.
          <button
            type="button"
            onClick={() => setShowSuccessToast(false)}
            className="ml-3 text-slate-500"
          >
            Close
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-20 items-center border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-lg font-bold text-slate-950">
            C
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-bold text-white">ClinicBot</h1>
            <p className="text-[11px] text-slate-500">
              Clinical Intake Agent
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Administration
          </p>
          <div className="rounded-xl bg-teal-400/10 px-3 py-3 text-sm font-semibold text-teal-300">
            Dashboard
          </div>

          <div className="mt-3 rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-slate-300">
            Doctor Management
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Access Level
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              Administrator
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Manage doctor accounts and monitor system statistics.
            </p>
          </div>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 rounded-xl bg-slate-900 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-slate-950">
                {dashboard ? getInitials(dashboard.admin.name) : "AD"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {dashboard?.admin.name || "Administrator"}
                </p>
                <p className="text-xs text-slate-500">System Admin</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-3 px-5 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                Administration Portal
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Admin Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm lg:hidden"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation"
              >
                Menu
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || doctorsLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Refresh
              </button>
              <div className="hidden h-8 w-px bg-slate-200 sm:block" />
              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {dashboard ? getInitials(dashboard.admin.name) : "AD"}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {dashboard?.admin.name || "Administrator"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Authorized Admin
                  </p>
                </div>
              </div>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden">
              <button
                type="button"
                onClick={logout}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          )}
        </header>

        <main className="px-5 py-8 sm:px-8">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
              System administration
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome, {dashboard?.admin.name || "Administrator"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage doctor accounts, view registered specialties,
              and monitor ClinicBot account statistics.
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <strong>Dashboard error:</strong> {error}
            </div>
          )}

          {/* Statistics */}
          {loading && !dashboard ? (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />
              <p className="mt-4 text-sm text-slate-500">
                Loading administration dashboard...
              </p>
            </div>
          ) : (
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Users",
                  value: dashboard?.statistics.total_users ?? 0,
                  note: "All registered accounts",
                  color: "text-slate-900",
                },
                {
                  label: "Patients",
                  value: dashboard?.statistics.total_patients ?? 0,
                  note: "Registered patient accounts",
                  color: "text-teal-600",
                },
                {
                  label: "Doctors",
                  value: dashboard?.statistics.total_doctors ?? 0,
                  note: "Authorized doctor accounts",
                  color: "text-blue-600",
                },
                {
                  label: "Administrators",
                  value: dashboard?.statistics.total_admins ?? 0,
                  note: "System administrator accounts",
                  color: "text-emerald-600",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className={`mt-3 text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {stat.note}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Add Doctor */}
          <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                Healthcare team
              </p>
              <h2 className="mt-1 text-lg font-bold">Add a Doctor</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create a doctor account and assign a specialty.
              </p>
            </div>

            <form
              onSubmit={handleAddDoctor}
              className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"
            >
              <div>
                <label htmlFor="doctorName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Full name
                </label>
                <input
                  id="doctorName"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Ayesha Malik"
                  required
                  maxLength={100}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div>
                <label htmlFor="doctorEmail" className="mb-2 block text-sm font-semibold text-slate-700">
                  Doctor email
                </label>
                <input
                  id="doctorEmail"
                  type="email"
                  value={doctorEmail}
                  onChange={(e) => setDoctorEmail(e.target.value)}
                  placeholder="doctor@clinicbot.com"
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Must end with @clinicbot.com
                </p>
              </div>

              <div>
                <label htmlFor="doctorPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                  Initial password
                </label>
                <input
                  id="doctorPassword"
                  type="password"
                  value={doctorPassword}
                  onChange={(e) => setDoctorPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Keep this password private.
                </p>
              </div>

              <div>
                <label htmlFor="doctorSpecialty" className="mb-2 block text-sm font-semibold text-slate-700">
                  Specialty
                </label>
                <select
                  id="doctorSpecialty"
                  value={doctorSpecialty}
                  onChange={(e) => setDoctorSpecialty(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {SPECIALTIES.map((specialty) => (
                    <option key={specialty} value={specialty}>
                      {specialty}
                    </option>
                  ))}
                </select>
              </div>

              {doctorError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
                  {doctorError}
                </div>
              )}

              {doctorSuccess && (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 sm:col-span-2">
                  {doctorSuccess}
                </div>
              )}

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={addingDoctor}
                  className="w-full rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {addingDoctor ? "Creating account..." : "+ Add Doctor"}
                </button>
              </div>
            </form>
          </section>

          {/* Registered Doctors */}
          <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                  Account directory
                </p>
                <h2 className="mt-1 text-lg font-bold">
                  Registered Doctors
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {doctors.length} doctor account(s)
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDoctors}
                disabled={doctorsLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {doctorsLoading ? "Loading..." : "Refresh List"}
              </button>
            </div>

            {doctorError && !doctorSuccess && (
              <p className="px-5 pt-4 text-sm text-red-600">
                {doctorError}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Doctor</th>
                    <th className="px-5 py-4">Email</th>
                    <th className="px-5 py-4">Specialty</th>
                    <th className="px-5 py-4">ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors.map((doctor) => (
                    <tr key={doctor.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4 font-semibold text-slate-800">
                        {doctor.full_name}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {doctor.email}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                          {doctor.specialty || "Not assigned"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {doctor.id}
                      </td>
                    </tr>
                  ))}

                  {!doctorsLoading && doctors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                        No doctors found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Admin Account Information */}
          <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                Administrator account
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Account Information
              </h2>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Name</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {dashboard?.admin.name || "Not available"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">Email</p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                  {dashboard?.admin.email || "Not available"}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-400">User ID</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {dashboard?.admin.id ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-600">Access Role</p>
                <p className="mt-1 text-sm font-bold capitalize text-emerald-700">
                  {dashboard?.admin.role || "admin"}
                </p>
              </div>
            </div>
          </section>

          {/* System Overview */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                System overview
              </p>
              <h2 className="mt-1 text-lg font-bold">
                ClinicBot Administration
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Current account distribution across ClinicBot.
              </p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3 sm:p-6">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-teal-600">
                  Patient access
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Patients can register, authenticate, and complete
                  pre-consultation intake sessions.
                </p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Doctor access
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Doctors can review assigned patient intake information
                  and AI-assisted clinical summaries.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Admin access
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Administrators manage doctor accounts and view
                  system-level account statistics.
                </p>
              </div>
            </div>
          </section>

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
  );
}