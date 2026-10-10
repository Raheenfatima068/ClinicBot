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

type SoapSection = {
  title: string;
  description: string;
  content: string;
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
  const [selectedPatient, setSelectedPatient] =
    useState<Patient | null>(null);

  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatusValue, setReviewStatusValue] =
    useState("reviewed");

  const [savingReview, setSavingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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
    const timer = window.setTimeout(() => {
      fetchDashboard("", "");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
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
  function openPatientHistory(patient: Patient) {
  setSelectedPatient(patient);
}

  function closePatientHistory() {
  setSelectedPatient(null);
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

      setReviewMessage("Clinical summary updated successfully.");
      setShowSuccessToast(true);

      setTimeout(() => {
      setShowSuccessToast(false);
     }, 3500);

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
        return "border-emerald-200 bg-emerald-50 text-emerald-700";

      case "reviewed":
        return "border-blue-200 bg-blue-50 text-blue-700";

      case "pending":
        return "border-amber-200 bg-amber-50 text-amber-700";

      default:
        return "border-slate-200 bg-slate-100 text-slate-600";
    }
  }
  function getCommonComplaints(sessions: Session[]) {
  const complaintCounts: Record<string, number> = {};

  sessions.forEach((session) => {
    const complaint =
      session.intake_session.chief_complaint?.trim();

    if (!complaint) {
      return;
    }

    const normalizedComplaint =
      complaint.charAt(0).toUpperCase() +
      complaint.slice(1);

    complaintCounts[normalizedComplaint] =
      (complaintCounts[normalizedComplaint] || 0) + 1;
  });

  return Object.entries(complaintCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 5);
}function getReviewActivity(sessions: Session[]) {
  return sessions
    .filter((session) => session.clinical_summary)
    .sort(
      (a, b) =>
        new Date(
          b.clinical_summary?.updated_at || ""
        ).getTime() -
        new Date(
          a.clinical_summary?.updated_at || ""
        ).getTime()
    )
    .slice(0, 5);
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

  function parseSoapSummary(
    summary: string
  ): SoapSection[] {
    const sections: SoapSection[] = [];

    const normalized = summary.replace(/\r\n/g, "\n");

    const patterns = [
      {
        key: "S",
        title: "Subjective",
        description:
          "Patient-reported symptoms, concerns and history.",
      },
      {
        key: "O",
        title: "Objective",
        description:
          "Available objective or documented clinical information.",
      },
      {
        key: "A",
        title: "Assessment",
        description:
          "Clinical assessment generated from the available intake information.",
      },
      {
        key: "P",
        title: "Plan",
        description:
          "Documented next steps or considerations for professional review.",
      },
    ];

    const matches: {
      index: number;
      key: string;
      title: string;
      description: string;
    }[] = [];

    for (const pattern of patterns) {
      const regex = new RegExp(
        `(?:^|\\n)\\s*(?:${pattern.key}\\s*[-:.]?|${pattern.title}\\s*[-:]?)\\s*`,
        "i"
      );

      const match = regex.exec(normalized);

      if (match && match.index !== undefined) {
        matches.push({
          index: match.index,
          key: pattern.key,
          title: pattern.title,
          description: pattern.description,
        });
      }
    }

    if (matches.length === 0) {
      return [
        {
          title: "Clinical Summary",
          description:
            "AI-assisted clinical documentation for professional review.",
          content: summary,
        },
      ];
    }

    matches.sort((a, b) => a.index - b.index);

    matches.forEach((match, index) => {
      const nextIndex =
        index < matches.length - 1
          ? matches[index + 1].index
          : normalized.length;

      const rawContent = normalized
        .slice(match.index, nextIndex)
        .replace(
          new RegExp(
            `^\\s*(?:${match.key}\\s*[-:.]?|${match.title}\\s*[-:]?)\\s*`,
            "i"
          ),
          ""
        )
        .trim();

      if (rawContent) {
        sections.push({
          title: match.title,
          description: match.description,
          content: rawContent,
        });
      }
    });

    return sections.length > 0
      ? sections
      : [
          {
            title: "Clinical Summary",
            description:
              "AI-assisted clinical documentation for professional review.",
            content: summary,
          },
        ];
  }

  function formatDate(date: string) {
    try {
      return new Date(date).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
        }
      );
    } catch {
      return date;
    }
  }

  return (
  <>
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
              Review saved
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Clinical summary updated successfully.
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

    <div
  className={`min-h-screen transition-colors duration-300 ${
    darkMode
      ? "bg-[#252827] text-[#F5F0E6]"
      : "bg-[#F5F0E6] text-[#303735]"
  }`}
>
      {/* Sidebar */}
      <aside
  className={`fixed inset-y-0 left-0 z-30 hidden w-64 border-r transition-colors duration-300 lg:flex lg:flex-col ${
    darkMode
      ? "border-slate-700 bg-[#202523]"
      : "border-[#DED8CA] bg-[#EDE6D8]"
  }`}
>
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

        <nav className="flex-1 px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            Workspace
          </p>

          <button
            onClick={() => {
              setReviewStatus("");
              fetchDashboard(search, "");
            }}
            className="flex w-full items-center gap-3 rounded-xl bg-teal-400/10 px-3 py-3 text-sm font-semibold text-teal-300"
          >
            <span className="text-lg">⌂</span>
            Dashboard
          </button>

          <button
            onClick={() => {
              setReviewStatus("pending");
              fetchDashboard(search, "pending");
            }}
            className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:shadow-sm ${
  darkMode
    ? "text-slate-300 hover:bg-teal-900/40 hover:text-teal-200"
    : "text-[#525B56] hover:bg-[#D8E9E3] hover:text-[#0F766E]"
}`}
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

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-20 items-center justify-between px-5 sm:px-8">
            <div>
              <div>
  <p className="text-sm font-medium text-slate-500">
    Welcome back, Doctor
  </p>

  <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
    Good to see you,{" "}
    <span className="text-teal-600">
      {dashboard?.doctor.name || "Doctor"}
    </span>
  </h2>

  <p className="mt-1 text-sm text-slate-500">
    Review patient intake information and AI-assisted clinical summaries.
  </p>
</div>
            </div>

            <div className="flex items-center gap-4">
           <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label={
            mobileMenuOpen
            ? "Close navigation menu"
            : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
          >
          <span className="text-xl">☰</span>
          </button>

          <button
          type="button"
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

{mobileMenuOpen && (
  <div className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
    <nav
      aria-label="Mobile navigation"
      className="space-y-2"
    >
      <button
        type="button"
        onClick={() => {
          setReviewStatus("");
          fetchDashboard(search, "");
          setMobileMenuOpen(false);
        }}
        className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
      >
        Dashboard
      </button>

      <button
        type="button"
        onClick={() => {
          setReviewStatus("pending");
          fetchDashboard(search, "pending");
          setMobileMenuOpen(false);
        }}
        className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
      >
        Pending Reviews
      </button>

      <button
        type="button"
        onClick={() => {
          setReviewStatus("reviewed");
          fetchDashboard(search, "reviewed");
          setMobileMenuOpen(false);
        }}
        className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
      >
        Reviewed
      </button>

      <button
        type="button"
        onClick={() => {
          setReviewStatus("approved");
          fetchDashboard(search, "approved");
          setMobileMenuOpen(false);
        }}
        className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-teal-50 hover:text-teal-700"
      >
        Approved
      </button>
    </nav>
  </div>
)}

        <main
  className={`px-5 py-8 transition-colors duration-300 sm:px-8 ${
    darkMode ? "text-[#F5F0E6]" : "text-[#303735]"
  }`}
>
          {/* Welcome */}
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
              Clinical workspace
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Good to see you,{" "}
              {dashboard?.doctor.name
                ? dashboard.doctor.name.replace("Dr. ", "")
                : "Doctor"}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Review patient intake information and
              AI-assisted clinical summaries before
              consultation.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>
            </div>
          )}{/* Dashboard Overview */}
<div className="mb-8 grid gap-6 xl:grid-cols-2">
  {/* Common Complaints */}
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-bold text-slate-900">
          Common Complaints
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Most reported patient complaints
        </p>
      </div>

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        <span className="text-sm">▥</span>
      </div>
    </div>

    <div className="mt-5 space-y-4">
      {getCommonComplaints(dashboard?.sessions ?? []).length > 0 ? (
        getCommonComplaints(dashboard?.sessions ?? []).map(
          ([complaint, count]) => (
            <div
              key={complaint}
              className="flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {complaint}
                </p>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (count * 100) /
                          Math.max(
                            1,
                            getCommonComplaints(
                              dashboard?.sessions ?? []
                            )[0]?.[1] ?? 1
                          )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {count}
              </span>
            </div>
          )
        )
      ) : (
        <div className="rounded-xl bg-slate-50 p-5 text-center">
          <p className="text-sm font-medium text-slate-500">
            No complaint data available
          </p>
        </div>
      )}
    </div>
  </section>

  {/* Review Activity */}
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-bold text-slate-900">
          Review Activity
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Latest clinical summary updates
        </p>
      </div>

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <span className="text-sm">◷</span>
      </div>
    </div>

    <div className="mt-5 space-y-3">
      {getReviewActivity(dashboard?.sessions ?? []).length > 0 ? (
        getReviewActivity(dashboard?.sessions ?? []).map((session) => {
          const summary = session.clinical_summary;

          return (
            <div
              key={session.intake_session.session_id}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {session.patient.full_name}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  Session #{session.intake_session.session_id}
                  {" · "}
                  {summary?.updated_at
                    ? new Date(summary.updated_at).toLocaleDateString()
                    : "Recently updated"}
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${getStatusStyle(
                  summary?.review_status
                )}`}
              >
                {summary?.review_status || "pending"}
              </span>
            </div>
          );
        })
      ) : (
        <div className="rounded-xl bg-slate-50 p-5 text-center">
          <p className="text-sm font-medium text-slate-500">
            No review activity yet
          </p>
        </div>
      )}
    </div>
  </section>
</div>


{/* Sessions */}

<section
  className={`overflow-hidden rounded-2xl border shadow-sm transition-colors duration-300 ${
    darkMode
      ? "border-slate-700 bg-[#303735]"
      : "border-[#E4DED2] bg-white"
  }`}
>

  {/* Section Header */}
<div
  className={`border-b px-5 py-5 transition-colors duration-300 sm:px-6 ${
    darkMode ? "border-slate-700" : "border-[#E4DED2]"
  }`}
>

    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            Patient Intake Sessions
          </h2>

          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
            {dashboard?.sessions.length ?? 0}
          </span>
        </div>

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
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
        </select>
      </div>
    </div>
  </div>

  {/* Loading State */}
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

  {/* Empty State */}
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

  {/* Sessions Table */}
  {!loading &&
    dashboard &&
    dashboard.sessions.length > 0 && (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
<thead
  className={`border-b transition-colors duration-300 ${
    darkMode
      ? "border-slate-700 bg-[#252827]"
      : "border-[#E4DED2] bg-[#F8F5EE]"
  }`}
>
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
                Review Status
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
  className={`transition-colors duration-200 ${
    darkMode ? "hover:bg-teal-900/20" : "hover:bg-[#F3F7F4]"
  }`}
>

{/* Patient */}
<td className="px-6 py-5">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700 ring-4 ring-teal-50/50">
      {getInitials(session.patient.full_name)}
    </div>

    <div className="min-w-0">
      <p
        className={`font-semibold ${
          darkMode ? "text-[#F5F0E6]" : "text-[#303735]"
        }`}
      >
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

<p
  className={`truncate text-sm font-medium ${
    darkMode ? "text-[#F5F0E6]" : "text-[#303735]"
  }`}
>
  {session.intake_session.chief_complaint || "Not provided"}
</p>

                </td>

                {/* Duration */}
                <td className="px-6 py-5">
<span
  className={`text-sm ${
    darkMode ? "text-slate-300" : "text-[#626B66]"
  }`}
>
  {session.intake_session.symptom_duration || "—"}
</span>
                </td>

                {/* Session */}
                <td className="px-6 py-5">
                  <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    Session #
                    {session.intake_session.session_id}
                  </span>

                  <p className="mt-1 text-xs capitalize text-slate-400">
                    {session.intake_session.status}
                  </p>
                </td>

                {/* Review Status */}
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

                {/* Actions */}
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        openPatientHistory(
                          session.patient
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                    >
                      History
                    </button>

                    <button
                      onClick={() =>
                        openSession(session)
                      }
                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                    >
                      Review
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
</section>

          <button
            onClick={() =>
              fetchDashboard(search, reviewStatus)
            }
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm sm:hidden"
          >
            ↻ Refresh Dashboard
          </button>
<button
  type="button"
  onClick={() => setDarkMode((current) => !current)}
  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 hover:shadow-md"
  title={darkMode ? "Switch to light mode" : "Switch to night mode"}
  aria-label={darkMode ? "Switch to light mode" : "Switch to night mode"}
>
  {darkMode ? "☀ Light" : "☾ Night"}
</button>
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
{/* Patient Session History Modal */}
{selectedPatient && (
  <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
    <div className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Patient Session History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {selectedPatient.full_name}
            </p>
          </div>

          <button
            onClick={closePatientHistory}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        {/* Patient Overview */}
        <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:grid-cols-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Patient
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {selectedPatient.full_name}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Age
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {selectedPatient.age ?? "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Gender
            </p>
            <p className="mt-1 font-semibold capitalize text-slate-800">
              {selectedPatient.gender || "Not provided"}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Phone
            </p>
            <p className="mt-1 font-semibold text-slate-800">
              {selectedPatient.phone || "Not provided"}
            </p>
          </div>
        </div>

        {/* Session History */}
        <div className="px-5 py-6 sm:px-7">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900">
              Previous Intake Sessions
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Review this patient&apos;s previous clinical intake records.
            </p>
          </div>

          <div className="space-y-4">
            {(dashboard?.sessions ?? [])
              .filter(
                (session) =>
                  session.patient.patient_id === selectedPatient.patient_id
              )
              .map((session) => (
                <div
                  key={session.intake_session.session_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                          Session #
                          {session.intake_session.session_id}
                        </span>

                        {session.clinical_summary && (
                          <span
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(
                              session.clinical_summary.review_status
                            )}`}
                          >
                            {session.clinical_summary.review_status}
                          </span>
                        )}
                      </div>

                      <h4 className="mt-3 text-base font-bold text-slate-900">
                        {session.intake_session.chief_complaint ||
                          "No chief complaint provided"}
                      </h4>

                      <p className="mt-1 text-sm text-slate-500">
                        Duration:{" "}
                        {session.intake_session.symptom_duration ||
                          "Not provided"}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        closePatientHistory();
                        openSession(session);
                      }}
                      className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-100"
                    >
                      Open Review
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">
                        Symptoms
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {session.symptoms.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">
                        Medical History
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {session.medical_history.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">
                        Medications
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {session.medications.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-400">
                        Allergies
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {session.allergies.length}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

            {(dashboard?.sessions ?? []).filter(
              (session) =>
                session.patient.patient_id === selectedPatient.patient_id
            ).length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-semibold text-slate-600">
                  No previous sessions found.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      {/* Clinical Review Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 font-bold text-teal-700">
                      {getInitials(
                        selectedSession.patient.full_name
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedSession.patient.full_name}
                        </h2>

                        {selectedSession.clinical_summary && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusStyle(
                              selectedSession.clinical_summary
                                .review_status
                            )}`}
                          >
                            {
                              selectedSession
                                .clinical_summary
                                .review_status
                            }
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Session #
                        {
                          selectedSession.intake_session
                            .session_id
                        }{" "}
                        ·{" "}
                        {formatDate(
                          selectedSession.intake_session
                            .created_at
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={closeSession}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close clinical review"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
                {/* Clinical Content */}
                <div className="min-w-0 p-5 sm:p-7">
                  {/* Patient overview */}
                  <div className="mb-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                          Patient overview
                        </p>

                        <h3 className="mt-1 text-base font-bold text-slate-900">
                          Pre-consultation information
                        </h3>
                      </div>

                      <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                        Intake
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-400">
                          Age
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.patient.age ??
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Gender
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.patient.gender ||
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Phone
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.patient.phone ||
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Language
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.patient
                            .preferred_language ||
                            "Not provided"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400">
                          Chief complaint
                        </p>

                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                          {selectedSession.intake_session
                            .chief_complaint ||
                            "Not provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">
                          Symptom duration
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.intake_session
                            .symptom_duration ||
                            "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clinical details */}
                  <div className="mb-7 grid gap-4 sm:grid-cols-2">
                    {/* Symptoms */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">
                          Symptoms
                        </h3>

                        <span className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">
                          {selectedSession.symptoms.length}
                        </span>
                      </div>

                      {selectedSession.symptoms.length > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.symptoms.map(
                            (item) => (
                              <div
                                key={item.id}
                                className="rounded-xl bg-slate-50 px-3 py-3"
                              >
                                <p className="text-sm font-medium text-slate-700">
                                  {item.name}
                                </p>

                                {(item.severity ||
                                  item.duration) && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {item.severity
                                      ? `Severity: ${item.severity}`
                                      : ""}
                                    {item.severity &&
                                    item.duration
                                      ? " · "
                                      : ""}
                                    {item.duration
                                      ? `Duration: ${item.duration}`
                                      : ""}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No symptoms reported.
                        </p>
                      )}
                    </div>

                    {/* Medical History */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="mb-4 text-sm font-bold text-slate-900">
                        Medical History
                      </h3>

                      {selectedSession.medical_history
                        .length > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.medical_history.map(
                            (item) => (
                              <div
                                key={item.id}
                                className="rounded-xl bg-slate-50 px-3 py-3"
                              >
                                <p className="text-sm font-medium text-slate-700">
                                  {item.condition}
                                </p>

                                {item.details && (
                                  <p className="mt-1 text-xs leading-5 text-slate-400">
                                    {item.details}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No medical history reported.
                        </p>
                      )}
                    </div>

                    {/* Medications */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="mb-4 text-sm font-bold text-slate-900">
                        Current Medications
                      </h3>

                      {selectedSession.medications
                        .length > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.medications.map(
                            (item) => (
                              <div
                                key={item.id}
                                className="rounded-xl bg-slate-50 px-3 py-3"
                              >
                                <p className="text-sm font-medium text-slate-700">
                                  {item.name}
                                </p>

                                {(item.dosage ||
                                  item.frequency) && (
                                  <p className="mt-1 text-xs text-slate-400">
                                    {item.dosage || ""}
                                    {item.dosage &&
                                    item.frequency
                                      ? " · "
                                      : ""}
                                    {item.frequency || ""}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No medications reported.
                        </p>
                      )}
                    </div>

                    {/* Allergies */}
                    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
                      <h3 className="mb-4 text-sm font-bold text-red-900">
                        Allergies
                      </h3>

                      {selectedSession.allergies.length > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.allergies.map(
                            (item) => (
                              <div
                                key={item.id}
                                className="rounded-xl bg-white px-3 py-3"
                              >
                                <p className="text-sm font-medium text-red-700">
                                  {item.allergen}
                                </p>

                                {item.reaction && (
                                  <p className="mt-1 text-xs text-red-500">
                                    Reaction:{" "}
                                    {item.reaction}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-red-400">
                          No allergies reported.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* SOAP Summary */}
                  <div>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                          AI-assisted documentation
                        </p>

                        <h3 className="mt-1 text-xl font-bold text-slate-900">
                          Clinical Summary
                        </h3>
                      </div>

                      <p className="text-xs text-slate-400">
                        Requires professional review
                      </p>
                    </div>

                    {selectedSession.clinical_summary ? (
                      <div className="space-y-4">
                        {parseSoapSummary(
                          selectedSession.clinical_summary
                            .summary
                        ).map((section) => (
                          <div
                            key={section.title}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                          >
                            <div className="mb-3 flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-700">
                                {section.title
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>
                                <h4 className="text-sm font-bold text-slate-900">
                                  {section.title}
                                </h4>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {section.description}
                                </p>
                              </div>
                            </div>

                            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                              {section.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                          —
                        </div>

                        <p className="mt-4 text-sm font-semibold text-slate-700">
                          No clinical summary available
                        </p>

                        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-400">
                          A clinical summary has not been
                          generated for this intake session.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Review Panel */}
                <aside className="border-t border-slate-200 bg-slate-50/80 p-5 sm:p-7 lg:border-l lg:border-t-0">
                  <div className="sticky top-24">
                    <div className="mb-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                        Doctor action
                      </p>

                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        Review Summary
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Confirm the review status and add
                        notes for the clinical record.
                      </p>
                    </div>

                    {selectedSession.clinical_summary ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Review status
                          </label>

                          <select
                            value={reviewStatusValue}
                            onChange={(event) =>
                              setReviewStatusValue(
                                event.target.value
                              )
                            }
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold capitalize text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
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

                          <div className="mt-5">
                            <label
                              htmlFor="doctor-notes"
                              className="text-xs font-bold uppercase tracking-wider text-slate-500"
                            >
                              Doctor notes
                            </label>

                            <textarea
                              id="doctor-notes"
                              value={reviewNotes}
                              onChange={(event) =>
                                setReviewNotes(
                                  event.target.value
                                )
                              }
                              rows={7}
                              placeholder="Add your clinical review notes..."
                              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                            />

                            <p className="mt-2 text-right text-[11px] text-slate-400">
                              {reviewNotes.length} characters
                            </p>
                          </div>

                          {reviewMessage && (
                            <div
                              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                                reviewMessage.includes(
                                  "successfully"
                                )
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                              }`}
                            >
                              {reviewMessage}
                            </div>
                          )}

                          <button
                            onClick={saveReview}
                            disabled={savingReview}
                            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingReview
                              ? "Saving review..."
                              : "Save Clinical Review"}
                          </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex gap-3">
                            <div className="mt-0.5 text-amber-700">
                              !
                            </div>

                            <div>
                              <p className="text-xs font-bold text-amber-900">
                                Professional review required
                              </p>

                              <p className="mt-1 text-xs leading-5 text-amber-800">
                                The AI-generated summary is
                                documentation support only. The
                                doctor remains responsible for
                                reviewing and approving the
                                clinical information.
                              </p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-white p-6">
                        <p className="text-sm font-semibold text-slate-700">
                          Review unavailable
                        </p>

                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          There is no generated clinical
                          summary to review for this session.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <p className="hidden text-xs text-slate-400 sm:block">
                  ClinicBot · Clinical review workspace
                </p>

                <button
                  onClick={closeSession}
                  className="ml-auto rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        </div>
            )}
    </div>
  </>
  );
}
