"use client";

import { useEffect, useState } from "react";

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

type ClinicalSummary = {
  summary_id: number;
  summary: string;
  review_status: string;
  doctor_notes: string | null;
  created_at: string;
  updated_at: string;
};

type DashboardSession = {
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
  sessions: DashboardSession[];
};

export default function Home() {
  const [dashboard, setDashboard] =
    useState<DashboardResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("access_token");

      if (!token) {
        setError(
          "Doctor login token not found. Please login first."
        );
        setLoading(false);
        return;
      }

      const response = await fetch(
        "http://127.0.0.1:8000/doctor/dashboard",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "Doctor access required. Please login with a doctor account."
          );
        }

        throw new Error(
          `Failed to load dashboard (${response.status})`
        );
      }

      const data: DashboardResponse =
        await response.json();

      setDashboard(data);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-semibold text-slate-800">
            ClinicBot
          </div>

          <p className="mt-2 text-slate-500">
            Loading doctor dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-slate-800">
            ClinicBot
          </h1>

          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-700">
              {error}
            </p>
          </div>

          <button
            onClick={fetchDashboard}
            className="mt-6 rounded-lg bg-slate-800 px-5 py-3 font-medium text-white hover:bg-slate-700"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!dashboard) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ClinicBot
            </h1>

            <p className="text-sm text-slate-500">
              Doctor Dashboard
            </p>
          </div>

          <div className="text-right">
            <p className="font-semibold text-slate-800">
              {dashboard.doctor.name}
            </p>

            <p className="text-sm capitalize text-slate-500">
              {dashboard.doctor.role}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Statistics */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Sessions
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {dashboard.statistics.total_sessions}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Pending Reviews
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {dashboard.statistics.pending_reviews}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Reviewed
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {dashboard.statistics.reviewed_summaries}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Approved
            </p>

            <p className="mt-2 text-3xl font-bold text-green-600">
              {dashboard.statistics.approved_summaries}
            </p>
          </div>
        </section>

        {/* Sessions */}
        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Patient Intake Sessions
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review patient information and clinical summaries.
              </p>
            </div>

            <button
              onClick={fetchDashboard}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {dashboard.sessions.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
              <p className="text-slate-500">
                No patient intake sessions found.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {dashboard.sessions.map((item) => (
                <div
                  key={item.intake_session.session_id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                >
                  {/* Patient Header */}
                  <div className="border-b bg-slate-50 px-6 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {item.patient.full_name}
                        </h3>

                        <p className="text-sm text-slate-500">
                          {item.patient.email}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                          Session #{item.intake_session.session_id}
                        </span>

                        {item.clinical_summary && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                            {item.clinical_summary.review_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-6 p-6 lg:grid-cols-2">
                    {/* Patient Information */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Patient Information
                      </h4>

                      <div className="mt-3 space-y-2 text-sm">
                        <p>
                          <span className="font-medium text-slate-600">
                            Age:
                          </span>{" "}
                          {item.patient.age ?? "Not provided"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-600">
                            Gender:
                          </span>{" "}
                          {item.patient.gender ?? "Not provided"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-600">
                            Phone:
                          </span>{" "}
                          {item.patient.phone ?? "Not provided"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-600">
                            Language:
                          </span>{" "}
                          {item.patient.preferred_language ??
                            "Not provided"}
                        </p>
                      </div>
                    </div>

                    {/* Intake Information */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Intake Information
                      </h4>

                      <div className="mt-3 space-y-2 text-sm">
                        <p>
                          <span className="font-medium text-slate-600">
                            Chief Complaint:
                          </span>{" "}
                          {item.intake_session.chief_complaint ??
                            "Not provided"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-600">
                            Duration:
                          </span>{" "}
                          {item.intake_session.symptom_duration ??
                            "Not provided"}
                        </p>

                        <p>
                          <span className="font-medium text-slate-600">
                            Session Status:
                          </span>{" "}
                          <span className="capitalize">
                            {item.intake_session.status}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Symptoms */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Symptoms
                      </h4>

                      {item.symptoms.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          None reported.
                        </p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {item.symptoms.map((symptom) => (
                            <li key={symptom.id}>
                              {symptom.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Medical History */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Medical History
                      </h4>

                      {item.medical_history.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          None reported.
                        </p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {item.medical_history.map((history) => (
                            <li key={history.id}>
                              {history.condition}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Medications */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Medications
                      </h4>

                      {item.medications.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          None reported.
                        </p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {item.medications.map((medication) => (
                            <li key={medication.id}>
                              {medication.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Allergies */}
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Allergies
                      </h4>

                      {item.allergies.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          None reported.
                        </p>
                      ) : (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {item.allergies.map((allergy) => (
                            <li key={allergy.id}>
                              {allergy.allergen}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Clinical Summary */}
                  {item.clinical_summary && (
                    <div className="border-t px-6 py-6">
                      <h4 className="font-semibold text-slate-900">
                        Clinical Summary
                      </h4>

                      <div className="mt-4 rounded-xl bg-slate-50 p-5">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                          {item.clinical_summary.summary}
                        </pre>
                      </div>

                      {item.clinical_summary.doctor_notes && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Doctor Notes
                          </p>

                          <p className="mt-2 text-sm text-slate-600">
                            {item.clinical_summary.doctor_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}