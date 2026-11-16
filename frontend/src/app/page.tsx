"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";

type ClinicalSummary = {
  summary_id: number;
  summary: string;
  review_status: string;
  doctor_notes: string | null;
  created_at: string;
  updated_at: string;
  ai_generated?: boolean;
  fallback_used?: boolean;
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
  doctor: { id: number; name: string; role: string };
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

const API_URL = "http://127.0.0.1:8001";
const THEME_CHANGE_EVENT = "clinicbot-theme-change";

function subscribeToTheme(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getThemeSnapshot() {
  return localStorage.getItem("clinicbot_theme") === "dark";
}

function getServerThemeSnapshot() {
  return false;
}
const NAV_ITEMS = [
  { label: "Dashboard", value: "" },
  { label: "Pending Reviews", value: "pending" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Approved", value: "approved" },
];

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
  const darkMode = useSyncExternalStore(
  subscribeToTheme,
  getThemeSnapshot,
  getServerThemeSnapshot
);

  // --------------------------------------------------
  // LOAD AND SAVE THEME PREFERENCE
  // --------------------------------------------------

  function toggleTheme() {
  const nextTheme = !darkMode;

  localStorage.setItem(
    "clinicbot_theme",
    nextTheme ? "dark" : "light"
  );

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

  // --------------------------------------------------
  // FETCH DASHBOARD
  // --------------------------------------------------

  const fetchDashboard = useCallback(
    async (searchValue: string, statusValue: string) => {
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
          params.set("search", searchValue.trim());
        }

        if (statusValue) {
          params.set("review_status", statusValue);
        }

        const queryString = params.toString();

        const response = await fetch(
          `${API_URL}/doctor/dashboard${
            queryString ? `?${queryString}` : ""
          }`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.detail || "Unable to load doctor dashboard."
          );
        }

        if (!data || !Array.isArray(data.sessions)) {
          throw new Error("The dashboard returned an invalid response.");
        }

        setDashboard(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to ClinicBot."
        );
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

 useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchDashboard("", "");
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [fetchDashboard]);
  // --------------------------------------------------
  // SEARCH AND FILTER
  // --------------------------------------------------

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    fetchDashboard(search, reviewStatus);
  }

  function handleStatusChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const value = event.target.value;
    setReviewStatus(value);
    fetchDashboard(search, value);
  }

  function changeNavigationStatus(status: string) {
    setReviewStatus(status);
    fetchDashboard(search, status);
    setMobileMenuOpen(false);
  }

  // --------------------------------------------------
  // SESSION AND PATIENT MODALS
  // --------------------------------------------------

  function openSession(session: Session) {
    setSelectedSession(session);
    setReviewNotes(session.clinical_summary?.doctor_notes || "");
    setReviewStatusValue(
      session.clinical_summary?.review_status || "reviewed"
    );
    setReviewMessage("");
  }

  function closeSession() {
    setSelectedSession(null);
    setReviewMessage("");
    setReviewNotes("");
    setReviewStatusValue("reviewed");
  }

  function openPatientHistory(patient: Patient) {
    setSelectedPatient(patient);
  }

  function closePatientHistory() {
    setSelectedPatient(null);
  }

  // --------------------------------------------------
  // SAVE CLINICAL REVIEW
  // --------------------------------------------------

  async function saveReview() {
    if (!selectedSession?.clinical_summary) {
      setReviewMessage(
        "No clinical summary is available to review."
      );
      return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    setSavingReview(true);
    setReviewMessage("");

    try {
      const sessionId =
        selectedSession.intake_session.session_id;

      const response = await fetch(
        `${API_URL}/doctor/sessions/${sessionId}/review`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            review_status: reviewStatusValue,
            doctor_notes: reviewNotes.trim() || null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail || "Unable to save clinical review."
        );
      }

      // Update the selected session immediately.
      setSelectedSession((current) => {
        if (!current?.clinical_summary) return current;

        return {
          ...current,
          clinical_summary: {
            ...current.clinical_summary,
            review_status: reviewStatusValue,
            doctor_notes: reviewNotes.trim() || null,
            updated_at: new Date().toISOString(),
          },
        };
      });

      setReviewMessage("Clinical summary updated successfully.");
      setShowSuccessToast(true);

      // Refresh the dashboard after the review is saved.
      await fetchDashboard(search, reviewStatus);
    } catch (err) {
      setReviewMessage(
        err instanceof Error
          ? err.message
          : "Unable to save clinical review."
      );
    } finally {
      setSavingReview(false);
    }
  }

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  function logout() {
    localStorage.removeItem("access_token");
    router.push("/login");
  }

  // --------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------

  function getStatusStyle(status?: string) {
    switch (status?.toLowerCase()) {
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

  function getInitials(name: string) {
    return name
      .split(" ")
      .filter(Boolean)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function formatDate(date: string) {
    if (!date) return "Date unavailable";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) return date;

    return parsedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getCommonComplaints(items: Session[]) {
    const counts: Record<string, number> = {};

    items.forEach((session) => {
      const complaint =
        session.intake_session.chief_complaint?.trim();

      if (!complaint) return;

      const normalized =
        complaint.charAt(0).toUpperCase() + complaint.slice(1);

      counts[normalized] = (counts[normalized] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }

  function getReviewActivity(items: Session[]) {
    return items
      .filter((session) => session.clinical_summary)
      .sort((a, b) => {
        const dateA = new Date(
          a.clinical_summary?.updated_at || ""
        ).getTime();

        const dateB = new Date(
          b.clinical_summary?.updated_at || ""
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);
  }

  // --------------------------------------------------
  // SOAP SUMMARY PARSER
  // --------------------------------------------------

  function parseSoapSummary(summary: string): SoapSection[] {
    const normalized = summary.replace(/\r\n/g, "\n");

    const definitions = [
      {
        title: "Subjective",
        description:
          "Patient-reported symptoms, concerns and history.",
        names: ["Subjective", "S"],
      },
      {
        title: "Objective",
        description:
          "Available objective or documented clinical information.",
        names: ["Objective", "O"],
      },
      {
        title: "Assessment",
        description:
          "Clinical assessment for professional review.",
        names: ["Assessment", "A"],
      },
      {
        title: "Plan",
        description:
          "Documented next steps or considerations for professional review.",
        names: ["Plan", "P"],
      },
    ];

    const sections: SoapSection[] = [];
    let currentSection: SoapSection | null = null;

    for (const line of normalized.split("\n")) {
      const trimmed = line.trim();

      const matchedDefinition = definitions.find((definition) =>
        definition.names.some((name) => {
          const escaped = name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

          return new RegExp(
            `^${escaped}(?:\\s*[-:.]\\s*|\\s*$)`,
            "i"
          ).test(trimmed);
        })
      );

      if (matchedDefinition) {
        currentSection = {
          title: matchedDefinition.title,
          description: matchedDefinition.description,
          content: "",
        };

        sections.push(currentSection);

        const headingMatch = trimmed.match(
          /^(?:Subjective|Objective|Assessment|Plan|S|O|A|P)\s*[-:.]\s*(.*)$/i
        );

        if (headingMatch?.[1]) {
          currentSection.content = headingMatch[1].trim();
        }

        continue;
      }

      if (currentSection) {
        currentSection.content +=
          (currentSection.content ? "\n" : "") + line;
      }
    }

    const validSections = sections
      .map((section) => ({
        ...section,
        content: section.content.trim(),
      }))
      .filter((section) => section.content.length > 0);

    if (validSections.length === 0) {
      return [
        {
          title: "Clinical Summary",
          description:
            "Clinical documentation for professional review.",
          content: normalized.trim(),
        },
      ];
    }

    return validSections;
  }

  // --------------------------------------------------
  // DERIVED DATA
  // --------------------------------------------------

  const sessions = dashboard?.sessions ?? [];
  const commonComplaints = getCommonComplaints(sessions);
  const reviewActivity = getReviewActivity(sessions);

  const maxComplaintCount = Math.max(
    1,
    commonComplaints[0]?.[1] ?? 1
  );

  const selectedSummary =
    selectedSession?.clinical_summary ?? null;

  const isFallbackSummary =
    selectedSummary?.fallback_used === true ||
    selectedSummary?.summary?.includes(
      "AI SUMMARY UNAVAILABLE — FALLBACK DRAFT"
    ) === true;

  const patientSessions = selectedPatient
    ? sessions.filter(
        (session) =>
          session.patient.patient_id ===
          selectedPatient.patient_id
      )
    : [];

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div
      className={`min-h-screen font-sans text-[16px] antialiased transition-colors duration-300 ${
        darkMode
          ? "clinicbot-dark bg-[#111827] text-slate-100"
          : "bg-[#F5F0E6] text-[#303735]"
      }`}
    >
      {/* SUCCESS TOAST */}
      {showSuccessToast && (
        <div
          className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm sm:right-6 sm:top-6"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              ✓
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">
                Review saved
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Clinical summary updated successfully.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuccessToast(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-20 items-center border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-lg font-bold text-slate-950">
            C
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-bold text-white">ClinicBot</h1>
            <p className="text-xs text-slate-400">
              Clinical Intake Agent
            </p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Workspace
          </p>

          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => changeNavigationStatus(item.value)}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                reviewStatus === item.value
                  ? "bg-teal-400/10 text-teal-300"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold">
                0{index + 1}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 rounded-xl bg-slate-900 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-400 text-xs font-bold text-slate-950">
                {dashboard ? getInitials(dashboard.doctor.name) : "DR"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {dashboard?.doctor.name || "Doctor"}
                </p>
                <p className="text-xs text-slate-400">Doctor</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-700 px-3 py-3 text-sm font-medium text-slate-200 transition hover:border-teal-400 hover:bg-slate-800"
          >
            <span>{darkMode ? "Light mode" : "Night mode"}</span>
            <span className="text-xs text-teal-300">
              {darkMode ? "ON" : "OFF"}
            </span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs">
              X
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="lg:pl-64">
        {/* HEADER */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-20 items-center justify-between gap-4 px-5 py-3 sm:px-8">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">
                Welcome back, Doctor
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Good to see you,{" "}
                <span className="text-teal-600">
                  {dashboard?.doctor.name || "Doctor"}
                </span>
              </h2>
              <p className="mt-1 hidden text-sm text-slate-500 sm:block">
                Review patient intake information and AI-assisted clinical summaries.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileMenuOpen((current) => !current)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                ☰
              </button>

              <button
                type="button"
                onClick={() => fetchDashboard(search, reviewStatus)}
                className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 sm:block"
              >
                Refresh
              </button>

              <div className="hidden h-8 w-px bg-slate-200 sm:block" />

              <div className="hidden items-center gap-3 sm:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {dashboard ? getInitials(dashboard.doctor.name) : "DR"}
                </div>
                <div>
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

        {/* MOBILE NAVIGATION */}
        {mobileMenuOpen && (
          <div className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm lg:hidden">
            <nav aria-label="Mobile navigation" className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => changeNavigationStatus(item.value)}
                  className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${
                    reviewStatus === item.value
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-700 hover:bg-teal-50 hover:text-teal-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fetchDashboard(search, reviewStatus)}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Refresh Dashboard
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {darkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </nav>
          </div>
        )}

        {/* DASHBOARD BODY */}
        <main className="px-5 py-8 sm:px-8">
          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => fetchDashboard(search, reviewStatus)}
                className="mt-2 text-sm font-bold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* OVERVIEW CARDS */}
          <div className="mb-8 grid gap-6 xl:grid-cols-2">
            {/* COMMON COMPLAINTS */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    Common Complaints
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Most reported patient complaints
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  ✚
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {commonComplaints.length > 0 ? (
                  commonComplaints.map(([complaint, count]) => (
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
                              width: `${(count / maxComplaintCount) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {count}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-slate-50 p-5 text-center">
                    <p className="text-sm text-slate-500">
                      No complaint data available
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* REVIEW ACTIVITY */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">
                    Review Activity
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest clinical summary updates
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  ✓
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {reviewActivity.length > 0 ? (
                  reviewActivity.map((session) => {
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
                          <p className="mt-1 text-xs text-slate-500">
                            Session #{session.intake_session.session_id}
                            {" · "}
                            {formatDate(
                              summary?.updated_at ||
                                session.intake_session.created_at
                            )}
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
                    <p className="text-sm text-slate-500">
                      No review activity yet
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* PATIENT SESSIONS */}
          <section className="overflow-hidden rounded-2xl border border-[#E4DED2] bg-white shadow-sm">
            <div className="border-b border-[#E4DED2] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      Patient Intake Sessions
                    </h2>
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                      {dashboard?.total_sessions ?? sessions.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Review patient information and clinical summaries.
                  </p>
                </div>

                {/* SEARCH AND FILTER */}
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end 2xl:w-auto">
                  <form
                    onSubmit={handleSearch}
                    className="relative w-full min-w-0 sm:w-72"
                  >
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg text-slate-400">
                      ⌕
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search patient..."
                      className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                    />
                    <button type="submit" className="sr-only">
                      Search
                    </button>
                  </form>

                  <select
                    value={reviewStatus}
                    onChange={handleStatusChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white sm:w-44"
                    aria-label="Filter by review status"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>
            </div>

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

            {!loading && dashboard && sessions.length === 0 && (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
                  ⌕
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  No sessions found
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or review filter.
                </p>
              </div>
            )}

            {!loading && dashboard && sessions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="border-b border-[#E4DED2] bg-[#F8F5EE]">
                    <tr>
                      {[
                        "Patient",
                        "Complaint",
                        "Duration",
                        "Session",
                        "Review Status",
                        "Action",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 ${
                            heading === "Action" ? "text-right" : "text-left"
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((session) => (
                      <tr
                        key={session.intake_session.session_id}
                        className="transition-colors hover:bg-[#F3F7F4]"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-bold text-teal-700">
                              {getInitials(session.patient.full_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">
                                {session.patient.full_name}
                              </p>
                              <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                                {session.patient.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="max-w-[230px] px-6 py-5">
                          <p className="truncate font-medium text-slate-700">
                            {session.intake_session.chief_complaint ||
                              "Not provided"}
                          </p>
                        </td>

                        <td className="px-6 py-5 text-slate-600">
                          {session.intake_session.symptom_duration ||
                            "Not recorded"}
                        </td>

                        <td className="px-6 py-5">
                          <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Session #{session.intake_session.session_id}
                          </span>
                          <p className="mt-1 text-xs capitalize text-slate-400">
                            {session.intake_session.status}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          {session.clinical_summary ? (
                            <span
                              className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusStyle(
                                session.clinical_summary.review_status
                              )}`}
                            >
                              {session.clinical_summary.review_status}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-400">
                              No summary
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openPatientHistory(session.patient)
                              }
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              onClick={() => openSession(session)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
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
            type="button"
            onClick={() => fetchDashboard(search, reviewStatus)}
            className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm sm:hidden"
          >
            Refresh Dashboard
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

      {/* PATIENT HISTORY MODAL */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
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
                  type="button"
                  onClick={closePatientHistory}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-5 py-5 sm:grid-cols-4 sm:px-7">
                {[
                  {
                    label: "Patient",
                    value: selectedPatient.full_name,
                  },
                  {
                    label: "Age",
                    value: selectedPatient.age ?? "Not provided",
                  },
                  {
                    label: "Gender",
                    value: selectedPatient.gender || "Not provided",
                  },
                  {
                    label: "Phone",
                    value: selectedPatient.phone || "Not provided",
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-1 font-semibold capitalize text-slate-800">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="px-5 py-6 sm:px-7">
                <h3 className="mb-2 text-lg font-bold text-slate-900">
                  Previous Intake Sessions
                </h3>
                <p className="mb-5 text-sm text-slate-500">
                  Patient records currently available in the loaded dashboard results.
                </p>

                <div className="space-y-4">
                  {patientSessions.map((session) => (
                    <div
                      key={session.intake_session.session_id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700">
                              Session #{session.intake_session.session_id}
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
                          type="button"
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
                        {[
                          {
                            label: "Symptoms",
                            count: session.symptoms?.length ?? 0,
                          },
                          {
                            label: "Medical History",
                            count: session.medical_history?.length ?? 0,
                          },
                          {
                            label: "Medications",
                            count: session.medications?.length ?? 0,
                          },
                          {
                            label: "Allergies",
                            count: session.allergies?.length ?? 0,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-xl bg-slate-50 p-3"
                          >
                            <p className="text-xs text-slate-400">
                              {item.label}
                            </p>
                            <p className="mt-1 text-lg font-bold text-slate-800">
                              {item.count}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {patientSessions.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                      <p className="font-semibold text-slate-600">
                        No previous sessions found in the loaded results.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLINICAL REVIEW MODAL */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
              {/* MODAL HEADER */}
              <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 font-bold text-teal-700">
                      {getInitials(selectedSession.patient.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-900">
                          {selectedSession.patient.full_name}
                        </h2>
                        {selectedSummary && (
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusStyle(
                              selectedSummary.review_status
                            )}`}
                          >
                            {selectedSummary.review_status}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Session #{selectedSession.intake_session.session_id}
                        {" · "}
                        {formatDate(selectedSession.intake_session.created_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeSession}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close clinical review"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* MODAL BODY */}
              <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
                {/* CLINICAL CONTENT */}
                <div className="min-w-0 p-5 sm:p-7">
                  {/* PATIENT OVERVIEW */}
                  <div className="mb-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                        Patient overview
                      </p>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        Pre-consultation information
                      </h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        {
                          label: "Age",
                          value: selectedSession.patient.age ?? "Not provided",
                        },
                        {
                          label: "Gender",
                          value:
                            selectedSession.patient.gender || "Not provided",
                        },
                        {
                          label: "Phone",
                          value:
                            selectedSession.patient.phone || "Not provided",
                        },
                        {
                          label: "Language",
                          value:
                            selectedSession.patient.preferred_language ||
                            "Not provided",
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-xs text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-semibold capitalize text-slate-800">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-400">
                          Chief complaint
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">
                          {selectedSession.intake_session.chief_complaint ||
                            "Not provided"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">
                          Symptom duration
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {selectedSession.intake_session.symptom_duration ||
                            "Not provided"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CLINICAL DETAILS */}
                  <div className="mb-7 grid gap-4 sm:grid-cols-2">
                    {/* SYMPTOMS */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">
                          Symptoms
                        </h3>
                        <span className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-700">
                          {selectedSession.symptoms?.length ?? 0}
                        </span>
                      </div>
                      {(selectedSession.symptoms?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.symptoms.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl bg-slate-50 px-3 py-3"
                            >
                              <p className="text-sm font-medium text-slate-700">
                                {item.name}
                              </p>
                              {(item.severity || item.duration) && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {item.severity
                                    ? `Severity: ${item.severity}`
                                    : ""}
                                  {item.severity && item.duration ? " · " : ""}
                                  {item.duration
                                    ? `Duration: ${item.duration}`
                                    : ""}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No symptoms reported.
                        </p>
                      )}
                    </div>

                    {/* MEDICAL HISTORY */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="mb-4 text-sm font-bold text-slate-900">
                        Medical History
                      </h3>
                      {(selectedSession.medical_history?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.medical_history.map((item) => (
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
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No medical history reported.
                        </p>
                      )}
                    </div>

                    {/* MEDICATIONS */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="mb-4 text-sm font-bold text-slate-900">
                        Current Medications
                      </h3>
                      {(selectedSession.medications?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.medications.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl bg-slate-50 px-3 py-3"
                            >
                              <p className="text-sm font-medium text-slate-700">
                                {item.name}
                              </p>
                              {(item.dosage || item.frequency) && (
                                <p className="mt-1 text-xs text-slate-400">
                                  {item.dosage || ""}
                                  {item.dosage && item.frequency ? " · " : ""}
                                  {item.frequency || ""}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No medications reported.
                        </p>
                      )}
                    </div>

                    {/* ALLERGIES */}
                    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
                      <h3 className="mb-4 text-sm font-bold text-red-900">
                        Allergies
                      </h3>
                      {(selectedSession.allergies?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {selectedSession.allergies.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl bg-white px-3 py-3"
                            >
                              <p className="text-sm font-medium text-red-700">
                                {item.allergen}
                              </p>
                              {item.reaction && (
                                <p className="mt-1 text-xs text-red-500">
                                  Reaction: {item.reaction}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-red-400">
                          No allergies reported.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* CLINICAL SUMMARY */}
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

                    {selectedSummary ? (
                      <div className="space-y-4">
                        {isFallbackSummary && (
                          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                            <div className="flex gap-3">
                              <div className="text-lg font-bold text-amber-700">
                                !
                              </div>
                              <div>
                                <p className="text-sm font-bold text-amber-900">
                                  AI SUMMARY UNAVAILABLE — FALLBACK DRAFT
                                </p>
                                <p className="mt-1 text-xs leading-5 text-amber-800">
                                  Gemini AI was unavailable when this summary
                                  was generated. This draft is based on
                                  patient-provided information and has not
                                  been verified by AI. The doctor must
                                  independently review the original intake
                                  information.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {parseSoapSummary(selectedSummary.summary || "").map(
                          (section, index) => (
                            <div
                              key={`${section.title}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                            >
                              <div className="mb-3 flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xs font-bold text-teal-700">
                                  {section.title.charAt(0).toUpperCase()}
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
                          )
                        )}
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
                          A clinical summary has not been generated for this
                          intake session.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* DOCTOR REVIEW PANEL */}
                <aside className="border-t border-slate-200 bg-slate-50/80 p-5 sm:p-7 lg:border-l lg:border-t-0">
                  <div className="lg:sticky lg:top-24">
                    <div className="mb-6">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-600">
                        Doctor action
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-slate-900">
                        Review Summary
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Confirm the review status and add notes for the
                        clinical record.
                      </p>
                    </div>

                    {selectedSummary ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                          <label
                            htmlFor="review-status"
                            className="text-xs font-bold uppercase tracking-wider text-slate-500"
                          >
                            Review status
                          </label>
                          <select
                            id="review-status"
                            value={reviewStatusValue}
                            onChange={(event) =>
                              setReviewStatusValue(event.target.value)
                            }
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold capitalize text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white"
                          >
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="approved">Approved</option>
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
                                setReviewNotes(event.target.value)
                              }
                              rows={7}
                              placeholder="Add your clinical review notes..."
                              className="mt-3 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                            />
                            <p className="mt-2 text-right text-xs text-slate-400">
                              {reviewNotes.length} characters
                            </p>
                          </div>

                          {reviewMessage && (
                            <div
                              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
                                reviewMessage.includes("successfully")
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-red-200 bg-red-50 text-red-700"
                              }`}
                              role="status"
                            >
                              {reviewMessage}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={saveReview}
                            disabled={savingReview}
                            className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingReview
                              ? "Saving review..."
                              : "Save Clinical Review"}
                          </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex gap-3">
                            <div className="mt-0.5 font-bold text-amber-700">
                              !
                            </div>
                            <div>
                              <p className="text-xs font-bold text-amber-900">
                                Professional review required
                              </p>
                              <p className="mt-1 text-xs leading-5 text-amber-800">
                                AI-assisted summaries are documentation
                                support only. The doctor must verify the
                                patient information and remains responsible
                                for the clinical review.
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
                          There is no generated clinical summary to review
                          for this session.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              {/* MODAL FOOTER */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
                <p className="hidden text-xs text-slate-400 sm:block">
                  ClinicBot · Clinical review workspace
                </p>
                <button
                  type="button"
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
  );
}