"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ClinicalSummary = {
  summary_id: number;
  summary: string;
  review_status: string;
  doctor_notes: string | null;
  created_at: string;
  updated_at: string;
};

type Patient = {
  patient_id: number;
  user_id: number;
  full_name: string;
  email: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
  preferred_language: string | null;
};

type IntakeSession = {
  session_id: number;
  status: string;
  chief_complaint: string | null;
  symptom_duration: string | null;
  created_at: string;
};

type Symptom = {
  id: number;
  name: string;
  severity: string | null;
  duration: string | null;
};

type MedicalHistory = {
  id: number;
  condition: string;
  details: string | null;
};

type Medication = {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
};

type Allergy = {
  id: number;
  allergen: string;
  reaction: string | null;
};

type Session = {
  patient: Patient;
  intake_session: IntakeSession;
  symptoms: Symptom[];
  medical_history: MedicalHistory[];
  medications: Medication[];
  allergies: Allergy[];
  clinical_summary: ClinicalSummary | null;
};

type DashboardResponse = {
  message: string;
  doctor: {
    id: number;
    name: string;
    role: string;
  };
  statistics: {
    total_sessions: number;
    pending_reviews: number;
    reviewed_summaries: number;
    approved_summaries: number;
  };
  total_sessions: number;
  filter: {
    review_status: string | null;
    search: string | null;
  };
  sessions: Session[];
};

export default function DoctorDashboard() {
  const router = useRouter();

  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  const [selectedSession, setSelectedSession] =
    useState<Session | null>(null);

  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatusValue, setReviewStatusValue] =
    useState("reviewed");

  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  async function fetchDashboard(
    searchValue = search,
    statusValue = reviewStatus
  ) {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (searchValue.trim()) {
        params.append("search", searchValue.trim());
      }

      if (statusValue) {
        params.append("review_status", statusValue);
      }

      const queryString = params.toString();

      const response = await fetch(
        `http://127.0.0.1:8000/doctor/dashboard${
          queryString ? `?${queryString}` : ""
        }`,
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
          data.detail || "Unable to load doctor dashboard."
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
    fetchDashboard("", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    fetchDashboard(search, reviewStatus);
  }

  function handleStatusChange(
    event: React.ChangeEvent<HTMLSelectElement>
  ) {
    const value = event.target.value;

    setReviewStatus(value);
    fetchDashboard(search, value);
  }

  function openSession(session: Session) {
    setSelectedSession(session);
    setReviewNotes(
      session.clinical_summary?.doctor_notes || ""
    );
    setReviewStatusValue(
      session.clinical_summary?.review_status || "reviewed"
    );
    setReviewMessage("");
  }

  function closeSession() {
    setSelectedSession(null);
    setReviewMessage("");
    setReviewNotes("");
  }

  async function saveReview() {
    if (!selectedSession) return;

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    setSavingReview(true);
    setReviewMessage("");

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/doctor/sessions/${selectedSession.intake_session.session_id}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            review_status: reviewStatusValue,
            doctor_notes: reviewNotes || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to save review."
        );
      }

      setReviewMessage(
        "Clinical summary updated successfully."
      );

      await fetchDashboard(search, reviewStatus);

      setSelectedSession((current) => {
        if (!current) return null;

        return {
          ...current,
          clinical_summary: current.clinical_summary
            ? {
                ...current.clinical_summary,
                review_status: reviewStatusValue,
                doctor_notes: reviewNotes || null,
              }
            : null,
        };
      });
    } catch (err) {
      if (err instanceof Error) {
        setReviewMessage(err.message);
      } else {
        setReviewMessage("Unable to save review.");
      }
    } finally {
      setSavingReview(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  function getStatusStyle(status: string | undefined) {
    switch (status) {
      case "approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "reviewed":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";

      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  }

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-800 bg-slate-950 lg:flex lg:flex-col">

        {/* Brand */}
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
            Workspace
          </p>

          <button className="flex w-full items-center gap-3 rounded-xl bg-teal-400/10 px-3 py-3 text-sm font-semibold text-teal-300">
            <span className="text-lg">⌂</span>
            Dashboard
          </button>

          <button
            onClick={() => {
              setReviewStatus("pending");
              fetchDashboard(search, "pending");
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <span className="text-lg">◷</span>
            Pending Reviews
          </button>

          <button
            onClick={() => {
              setReviewStatus("reviewed");
              fetchDashboard(search, "reviewed");
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <span className="text-lg">✓</span>
            Reviewed
          </button>

          <button
            onClick={() => {
              setReviewStatus("approved");
              fetchDashboard(search, "approved");
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <span className="text-lg">◆</span>
            Approved
          </button>

        </nav>

        {/* Sidebar Bottom */}
        <div className="border-t border-slate-800 p-4">

          <div className="mb-3 rounded-xl bg-slate-900 p-3">
            <div className="flex items-center gap-3">

              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-slate-950">
                {dashboard
                  ? getInitials(dashboard.doctor.name)
                  : "DR"}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {dashboard?.doctor.name || "Doctor"}
                </p>

                <p className="text-xs text-slate-500">
                  Doctor
                </p>
              </div>

            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <span>↪</span>
            Sign out
          </button>

        </div>

      </aside>

      {/* Main Area */}
      <div className="lg:pl-64">

        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                Doctor Portal
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Clinical Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-4">

              <button
                onClick={() =>
                  fetchDashboard(search, reviewStatus)
                }
                className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:block"
              >
                ↻ Refresh
              </button>

              <div className="hidden h-8 w-px bg-slate-200 sm:block" />

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {dashboard
                    ? getInitials(dashboard.doctor.name)
                    : "DR"}
                </div>

                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">
                    {dashboard?.doctor.name || "Doctor"}
                  </p>

                  <p className="text-xs text-slate-500">
                    Authorized Doctor
                  </p>
                </div>
              </div>

            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-5 py-8 sm:px-8">

          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Good to see you,{" "}
              {dashboard?.doctor.name
                ? dashboard.doctor.name.replace("Dr. ", "")
                : "Doctor"}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Review patient intake information and clinical summaries
              before consultation.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* Statistics */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {/* Total */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Total Sessions
                  </p>

                  <p className="mt-3 text-3xl font-bold text-slate-900">
                    {dashboard?.statistics.total_sessions ?? 0}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Patient intake sessions
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-600">
                  ◉
                </div>

              </div>
            </div>

            {/* Pending */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Pending Reviews
                  </p>

                  <p className="mt-3 text-3xl font-bold text-amber-600">
                    {dashboard?.statistics.pending_reviews ?? 0}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Awaiting doctor review
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-lg text-amber-600">
                  ◷
                </div>

              </div>
            </div>

            {/* Reviewed */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Reviewed
                  </p>

                  <p className="mt-3 text-3xl font-bold text-blue-600">
                    {dashboard?.statistics.reviewed_summaries ?? 0}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Clinically reviewed
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
                  ✓
                </div>

              </div>
            </div>

            {/* Approved */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">

                <div>
                  <p className="text-sm font-medium text-slate-500">
                    Approved
                  </p>

                  <p className="mt-3 text-3xl font-bold text-emerald-600">
                    {dashboard?.statistics.approved_summaries ?? 0}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    Ready for consultation
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">
                  ◆
                </div>

              </div>
            </div>

          </div>

          {/* Sessions Section */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            {/* Section Header */}
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">

              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Patient Intake Sessions
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review patient information and AI-assisted clinical summaries.
                  </p>
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col gap-3 sm:flex-row">

                  <form
                    onSubmit={handleSearch}
                    className="relative"
                  >
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      ⌕
                    </span>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search patient..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10 sm:w-64"
                    />
                  </form>

                  <select
                    value={reviewStatus}
                    onChange={handleStatusChange}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  >
                    <option value="">
                      All statuses
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="reviewed">
                      Reviewed
                    </option>

                    <option value="approved">
                      Approved
                    </option>
                  </select>

                </div>

              </div>

            </div>

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center px-6 py-20">
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />

                  <p className="mt-4 text-sm text-slate-500">
                    Loading patient sessions...
                  </p>
                </div>
              </div>
            )}

            {/* Empty */}
            {!loading &&
              dashboard &&
              dashboard.sessions.length === 0 && (
                <div className="px-6 py-20 text-center">

                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                    ◌
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    No sessions found
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Try changing your search or review filter.
                  </p>

                </div>
              )}

            {/* Desktop Table */}
            {!loading &&
              dashboard &&
              dashboard.sessions.length > 0 && (
                <div className="overflow-x-auto">

                  <table className="w-full min-w-[850px]">

                    <thead className="border-b border-slate-200 bg-slate-50/80">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Patient
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Complaint
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Duration
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Session
                        </th>

                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          Review
                        </th>

                        <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {dashboard.sessions.map((session) => (

                        <tr
                          key={session.intake_session.session_id}
                          className="transition hover:bg-slate-50"
                        >

                          {/* Patient */}
                          <td className="px-6 py-5">

                            <div className="flex items-center gap-3">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                                {getInitials(
                                  session.patient.full_name
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">
                                  {session.patient.full_name}
                                </p>

                                <p className="mt-0.5 max-w-[190px] truncate text-xs text-slate-500">
                                  {session.patient.email}
                                </p>
                              </div>

                            </div>

                          </td>

                          {/* Complaint */}
                          <td className="max-w-[230px] px-6 py-5">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {session.intake_session.chief_complaint ||
                                "Not provided"}
                            </p>
                          </td>

                          {/* Duration */}
                          <td className="px-6 py-5">
                            <span className="text-sm text-slate-600">
                              {session.intake_session
                                .symptom_duration || "—"}
                            </span>
                          </td>

                          {/* Session */}
                          <td className="px-6 py-5">

                            <div>
                              <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                #{session.intake_session.session_id}
                              </span>

                              <p className="mt-1 text-xs capitalize text-slate-400">
                                {session.intake_session.status}
                              </p>
                            </div>

                          </td>

                          {/* Review */}
                          <td className="px-6 py-5">

                            {session.clinical_summary ? (
                              <span
                                className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(
                                  session.clinical_summary
                                    .review_status
                                )}`}
                              >
                                {
                                  session.clinical_summary
                                    .review_status
                                }
                              </span>
                            ) : (
                              <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400">
                                No summary
                              </span>
                            )}

                          </td>

                          {/* Action */}
                          <td className="px-6 py-5 text-right">

                            <button
                              onClick={() =>
                                openSession(session)
                              }
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                            >
                              View Details
                            </button>

                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>
              )}

          </section>

          {/* Mobile refresh */}
          <button
            onClick={() =>
              fetchDashboard(search, reviewStatus)
            }
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm sm:hidden"
          >
            ↻ Refresh Dashboard
          </button>

          {/* Footer */}
          <footer className="mt-8 pb-4 text-center">
            <p className="text-xs text-slate-400">
              ClinicBot · AI-assisted clinical documentation
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Clinical summaries require professional doctor review.
            </p>
          </footer>

        </main>
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-sm">

          <div className="mx-auto max-w-5xl">

            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">

                <div className="flex items-center gap-4">

                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 font-bold text-teal-700">
                    {getInitials(
                      selectedSession.patient.full_name
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {selectedSession.patient.full_name}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Intake Session #
                      {selectedSession.intake_session.session_id}
                    </p>
                  </div>

                </div>

                <button
                  onClick={closeSession}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>

              </div>

              {/* Modal Content */}
              <div className="grid gap-0 lg:grid-cols-2">

                {/* Left */}
                <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">

                  <h3 className="mb-5 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Patient Information
                  </h3>

                  <div className="grid grid-cols-2 gap-4">

                    <div>
                      <p className="text-xs text-slate-400">
                        Age
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.patient.age ?? "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Gender
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.patient.gender || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Phone
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.patient.phone || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Language
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.patient
                          .preferred_language || "—"}
                      </p>
                    </div>

                  </div>

                  <div className="my-6 border-t border-slate-100" />

                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
                    Intake Information
                  </h3>

                  <div className="space-y-4">

                    <div>
                      <p className="text-xs text-slate-400">
                        Chief Complaint
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.intake_session
                          .chief_complaint || "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400">
                        Symptom Duration
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {selectedSession.intake_session
                          .symptom_duration || "Not provided"}
                      </p>
                    </div>

                  </div>

                  <div className="my-6 border-t border-slate-100" />

                  <div className="grid gap-5 sm:grid-cols-2">

                    {/* Symptoms */}
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-800">
                        Symptoms
                      </h3>

                      {selectedSession.symptoms.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedSession.symptoms.map(
                            (item) => (
                              <li
                                key={item.id}
                                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                              >
                                {item.name}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">
                          None reported
                        </p>
                      )}
                    </div>

                    {/* History */}
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-800">
                        Medical History
                      </h3>

                      {selectedSession.medical_history
                        .length > 0 ? (
                        <ul className="space-y-2">
                          {selectedSession.medical_history.map(
                            (item) => (
                              <li
                                key={item.id}
                                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                              >
                                {item.condition}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">
                          None reported
                        </p>
                      )}
                    </div>

                    {/* Medications */}
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-800">
                        Medications
                      </h3>

                      {selectedSession.medications.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedSession.medications.map(
                            (item) => (
                              <li
                                key={item.id}
                                className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                              >
                                {item.name}
                                {item.dosage
                                  ? ` · ${item.dosage}`
                                  : ""}
                                {item.frequency
                                  ? ` · ${item.frequency}`
                                  : ""}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">
                          None reported
                        </p>
                      )}
                    </div>

                    {/* Allergies */}
                    <div>
                      <h3 className="mb-3 text-sm font-bold text-slate-800">
                        Allergies
                      </h3>

                      {selectedSession.allergies.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedSession.allergies.map(
                            (item) => (
                              <li
                                key={item.id}
                                className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
                              >
                                {item.allergen}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">
                          None reported
                        </p>
                      )}
                    </div>

                  </div>

                </div>

                {/* Right */}
                <div className="bg-slate-50/70 p-6">

                  <div className="mb-5 flex items-center justify-between">

                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        Clinical Summary
                      </h3>

                      <p className="mt-1 text-xs text-slate-400">
                        AI-assisted documentation for doctor review
                      </p>
                    </div>

                    {selectedSession.clinical_summary && (
                      <span
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(
                          selectedSession.clinical_summary
                            .review_status
                        )}`}
                      >
                        {
                          selectedSession.clinical_summary
                            .review_status
                        }
                      </span>
                    )}

                  </div>

                  {selectedSession.clinical_summary ? (
                    <>
                      <div className="max-h-[390px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5">

                        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                          {
                            selectedSession.clinical_summary
                              .summary
                          }
                        </pre>

                      </div>

                      {/* Review */}
                      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">

                        <h3 className="text-sm font-bold text-slate-800">
                          Doctor Review
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          Update the clinical summary review status.
                        </p>

                        <label className="mt-4 block text-xs font-semibold text-slate-600">
                          Review Status
                        </label>

                        <select
                          value={reviewStatusValue}
                          onChange={(event) =>
                            setReviewStatusValue(
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                        >
                          <option value="pending">
                            Pending
                          </option>

                          <option value="reviewed">
                            Reviewed
                          </option>

                          <option value="approved">
                            Approved
                          </option>
                        </select>

                        <label className="mt-4 block text-xs font-semibold text-slate-600">
                          Doctor Notes
                        </label>

                        <textarea
                          value={reviewNotes}
                          onChange={(event) =>
                            setReviewNotes(event.target.value)
                          }
                          rows={4}
                          placeholder="Enter doctor review notes..."
                          className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                        />

                        {reviewMessage && (
                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                            {reviewMessage}
                          </div>
                        )}

                        <button
                          onClick={saveReview}
                          disabled={savingReview}
                          className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingReview
                            ? "Saving..."
                            : "Save Review"}
                        </button>

                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        —
                      </div>

                      <p className="mt-4 text-sm font-semibold text-slate-700">
                        No clinical summary available
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        A clinical summary has not been generated
                        for this session.
                      </p>
                    </div>
                  )}

                </div>

              </div>

              {/* Modal Footer */}
              <div className="border-t border-slate-200 bg-white px-6 py-4 text-right">

                <button
                  onClick={closeSession}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}