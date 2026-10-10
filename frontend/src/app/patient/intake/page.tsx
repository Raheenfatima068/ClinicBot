
"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type QuestionResponse = {
  question?: string;
  field?: string;
};

type ApiResponse = {
  message?: string;
  detail?: string | object;
  id?: number;
  question?: string;
  field?: string;
  answer?: string;
};

type ClinicalSummaryResponse = {
  session_id: number;
  summary_id: number;
  review_status: string;
  summary: string;
  doctor_notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000";

const progressMap: Record<string, number> = {
  chief_complaint: 15,
  symptom_duration: 30,
  symptoms: 45,
  medical_history: 60,
  medications: 75,
  allergies: 90,
  complete: 100,
};

function getErrorMessage(
  data: ApiResponse | null,
  fallback: string
): string {
  if (!data) return fallback;

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  if (data.detail && typeof data.detail === "object") {
    return JSON.stringify(data.detail);
  }

  return fallback;
}

async function readApiResponse(
  response: Response
): Promise<ApiResponse | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStatusClasses(status: string): string {
  switch (status.toLowerCase()) {
    case "approved":
      return "bg-green-100 text-green-700";
    case "reviewed":
      return "bg-blue-100 text-blue-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function PatientIntakePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [question, setQuestion] = useState(
    "Loading your intake session..."
  );

  const [answer, setAnswer] = useState("");
  const [progress, setProgress] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  const [clinicalSummary, setClinicalSummary] =
    useState<ClinicalSummaryResponse | null>(null);

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMessage, setSummaryMessage] = useState("");

  // Prevent repeated session creation during ordinary rerenders
  // and React development effect replay.
  const sessionStartRef = useRef(false);

  // Restore the patient's login token.
  useEffect(() => {
    const storedToken = localStorage.getItem(
      "patient_access_token"
    );

    if (!storedToken) {
      router.replace("/patient/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  // Load or generate the clinical summary for this session.
  const fetchClinicalSummary = useCallback(
    async (
      accessToken: string,
      currentSessionId: number
    ) => {
      setSummaryLoading(true);
      setSummaryMessage("");
      setClinicalSummary(null);

      const summaryUrl =
        `${API_BASE_URL}/ai/sessions/${currentSessionId}/soap-summary`;

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      };

      try {
        let response = await fetch(summaryUrl, {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (response.status === 404) {
          // Distinguish a nonexistent session from a missing summary.
          const missingBody = await response
            .clone()
            .json()
            .catch(() => null);

          const detail =
            typeof missingBody?.detail === "string"
              ? missingBody.detail.toLowerCase()
              : "";

          if (detail.includes("session not found")) {
            throw new Error(
              "This intake session was not found. Please start a new intake."
            );
          }

          // No saved summary: ask the backend to generate one.
          const generateResponse = await fetch(summaryUrl, {
            method: "POST",
            headers,
          });

          if (!generateResponse.ok) {
            const body = await readApiResponse(generateResponse);

            throw new Error(
              getErrorMessage(
                body,
                `Summary generation failed (${generateResponse.status}).`
              )
            );
          }

          response = await fetch(summaryUrl, {
            method: "GET",
            headers,
            cache: "no-store",
          });
        }

        if (!response.ok) {
          const body = await readApiResponse(response);

          if (response.status === 401) {
            throw new Error(
              "Your login session has expired. Please log in again."
            );
          }

          if (response.status === 403) {
            throw new Error(
              "You do not have permission to view this clinical summary."
            );
          }

          throw new Error(
            getErrorMessage(
              body,
              `Could not load the clinical summary (${response.status}).`
            )
          );
        }

        const data =
          (await response.json()) as ClinicalSummaryResponse;

        if (
          typeof data.summary !== "string" ||
          !data.summary.trim()
        ) {
          throw new Error(
            "The server returned an empty clinical summary."
          );
        }

        setClinicalSummary(data);
        setSummaryMessage("");
      } catch (err) {
        setClinicalSummary(null);
        setSummaryMessage(
          err instanceof Error
            ? err.message
            : "Unable to load the clinical summary."
        );
      } finally {
        setSummaryLoading(false);
      }
    },
    []
  );

  // Retrieve the next question for the current session.
  const getNextQuestion = useCallback(
    async (
      accessToken: string,
      currentSessionId: number
    ) => {
      try {
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/conversation/sessions/${currentSessionId}/next-question`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
            cache: "no-store",
          }
        );

        const data = (await readApiResponse(
          response
        )) as QuestionResponse | null;

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your login session has expired. Please log in again."
            );
          }

          throw new Error(
            getErrorMessage(
              data as ApiResponse | null,
              "Unable to load the next question."
            )
          );
        }

        if (!data?.question || !data?.field) {
          throw new Error(
            "The server returned an invalid question."
          );
        }

        setQuestion(data.question);
        setProgress(progressMap[data.field] ?? 0);

        if (data.field === "complete") {
          setProgress(100);
          setCompleted(true);

          await fetchClinicalSummary(
            accessToken,
            currentSessionId
          );
        } else {
          setCompleted(false);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the next question."
        );
      }
    },
    [fetchClinicalSummary]
  );

  // Create one intake session and load its first question.
  const createSession = useCallback(
    async (accessToken: string) => {
      try {
        setLoading(true);
        setError("");
        setAnswer("");
        setSessionId(null);
        setProgress(0);
        setCompleted(false);
        setClinicalSummary(null);
        setSummaryMessage("");

        const response = await fetch(
          `${API_BASE_URL}/intake/sessions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          }
        );

        const data = await readApiResponse(response);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(
              "Your login session has expired. Please log in again."
            );
          }

          throw new Error(
            getErrorMessage(
              data,
              "Unable to create your intake session."
            )
          );
        }

        if (!data || typeof data.id !== "number") {
          throw new Error(
            "The server did not return a valid intake session ID."
          );
        }

        setSessionId(data.id);

        await getNextQuestion(accessToken, data.id);
      } catch (err) {
        // Allow the patient to retry after a failed request.
        sessionStartRef.current = false;

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while starting your intake."
        );
      } finally {
        setLoading(false);
      }
    },
    [getNextQuestion]
  );

  // Start the intake once after restoring the login token.
  useEffect(() => {
    if (!token || sessionStartRef.current) {
      return;
    }

    sessionStartRef.current = true;
    void createSession(token);
  }, [token, createSession]);

  // Retry session creation if the initial request failed.
  function retrySession() {
    if (!token || loading) return;

    sessionStartRef.current = true;
    void createSession(token);
  }

  // Submit the patient's current answer.
  async function submitAnswer(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!token || sessionId === null) {
      setError("Your intake session is not available.");
      return;
    }

    const trimmedAnswer = answer.trim();

    if (!trimmedAnswer) {
      setError("Please enter an answer before continuing.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/conversation/sessions/${sessionId}/answer?answer=${encodeURIComponent(trimmedAnswer)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your login session has expired. Please log in again."
          );
        }

        throw new Error(
          getErrorMessage(
            data,
            "Unable to save your answer."
          )
        );
      }

      setAnswer("");

      await getNextQuestion(token, sessionId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your answer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    localStorage.removeItem("patient_access_token");
    router.replace("/patient/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold text-teal-700">
              ClinicBot
            </h1>
            <p className="text-sm text-slate-500">
              Clinical Intake Agent
            </p>
          </div>

          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Patient Portal
          </p>

          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            Pre-Consultation Intake
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Answer a few questions about your health so your
            clinical information can be prepared for your doctor.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Your health information
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {sessionId !== null
                  ? `Session #${sessionId}`
                  : "Preparing your session"}
              </p>
            </div>

            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              {completed ? "Completed" : "In progress"}
            </span>
          </div>

          <div
            className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-label="Intake progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mb-5 flex justify-between text-xs text-slate-500">
            <span>Start</span>
            <span>{progress}% complete</span>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p className="font-semibold">Something went wrong</p>
              <p className="mt-1 break-words">{error}</p>

              {!sessionId && (
                <button
                  type="button"
                  onClick={retrySession}
                  disabled={loading || !token}
                  className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Try again
                </button>
              )}

              {error.toLowerCase().includes("login session") && (
                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 ml-2 rounded-lg border border-red-300 px-4 py-2 font-medium hover:bg-red-100"
                >
                  Log in again
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center py-12 text-center">
              <div
                className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600"
                aria-label="Loading"
              />

              <p className="font-medium text-slate-700">
                Preparing your intake session...
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Please wait a moment.
              </p>
            </div>
          ) : completed ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <h3 className="text-lg font-bold text-green-800">
                  Intake completed
                </h3>

                <p className="mt-2 text-sm leading-6 text-green-800">
                  Thank you. Your answers have been submitted.
                  Your clinical summary is shown below when available.
                  Your doctor should review the information before
                  making clinical decisions.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-900">
                    Clinical Summary
                  </h3>

                  {clinicalSummary && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(
                        clinicalSummary.review_status
                      )}`}
                    >
                      {formatStatus(
                        clinicalSummary.review_status
                      )}
                    </span>
                  )}
                </div>

                {summaryLoading ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Loading your clinical summary...
                  </p>
                ) : clinicalSummary ? (
                  <>
                    <div className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                      {clinicalSummary.summary}
                    </div>

                    {clinicalSummary.doctor_notes && (
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <h4 className="font-semibold text-slate-800">
                          Doctor&apos;s Notes
                        </h4>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {clinicalSummary.doctor_notes}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm leading-6 text-slate-600">
                      {summaryMessage ||
                        "Your clinical summary is not available yet."}
                    </p>

                    {token && sessionId !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          void fetchClinicalSummary(token, sessionId)
                        }
                        disabled={summaryLoading}
                        className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                      >
                        Retry summary
                      </button>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs leading-5 text-slate-500">
                This summary is intended to support your clinician.
                It is not a diagnosis or a substitute for medical advice.
              </p>
            </div>
          ) : (
            <form onSubmit={submitAnswer}>
              <label
                htmlFor="patient-answer"
                className="mb-3 block text-lg font-semibold leading-7 text-slate-900"
              >
                {question}
              </label>

              <textarea
                id="patient-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer here..."
                rows={5}
                required
                disabled={submitting || !sessionId}
                className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-sm leading-6 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
              />

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-slate-500">
                  Please provide accurate information. You can
                  describe your symptoms in your own words.
                </p>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !sessionId ||
                    !answer.trim()
                  }
                  className="inline-flex min-w-32 items-center justify-center rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : "Continue"}
                </button>
              </div>
            </form>
          )}
        </section>

        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          Your answers help prepare information for your healthcare
          provider. ClinicBot does not independently diagnose
          conditions or prescribe medication.
        </p>
      </div>
    </main>
  );
}