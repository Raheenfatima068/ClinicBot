"use client";

import { FormEvent, useEffect, useState } from "react";
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
  if (!data) {
    return fallback;
  }

  if (typeof data.detail === "string") {
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  if (data.detail && typeof data.detail === "object") {
    try {
      return JSON.stringify(data.detail);
    } catch {
      return fallback;
    }
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

export default function PatientIntakePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [question, setQuestion] = useState(
    "Loading your intake session..."
  );
  const [field, setField] = useState("");

  const [answer, setAnswer] = useState("");

  const [progress, setProgress] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("patient_access_token");

    if (!storedToken) {
      router.push("/patient/login");
      return;
    }

    setToken(storedToken);
  }, [router]);

  useEffect(() => {
    if (!token) {
      return;
    }

    createSession(token);
  }, [token]);

  async function createSession(accessToken: string) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/intake/sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            "Unable to create your intake session."
          )
        );
      }

      if (!data?.id) {
        throw new Error(
          "The server did not return a valid intake session."
        );
      }

      setSessionId(data.id);

      await getNextQuestion(accessToken, data.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while starting your intake."
      );
    } finally {
      setLoading(false);
    }
  }

  async function getNextQuestion(
    accessToken: string,
    currentSessionId: number
  ) {
    try {
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/conversation/sessions/${currentSessionId}/next-question`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = (await readApiResponse(
        response
      )) as QuestionResponse | null;

      if (!response.ok) {
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
      setField(data.field);

      const currentProgress =
        progressMap[data.field] ?? 0;

      setProgress(currentProgress);

      if (data.field === "complete") {
        setCompleted(true);
        setProgress(100);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the next question."
      );
    }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();

    if (!token || !sessionId) {
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

      /*
       * IMPORTANT:
       * The FastAPI backend defines `answer: str` as a query parameter.
       * Therefore the answer must be sent in the URL.
       */
      const response = await fetch(
        `${API_BASE_URL}/conversation/sessions/${sessionId}/answer?answer=${encodeURIComponent(
          trimmedAnswer
        )}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
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

  function handleSignOut() {
    localStorage.removeItem("patient_access_token");
    router.push("/patient/login");
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />

          <p className="text-sm text-slate-600">
            Checking your secure session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg font-bold text-white">
              C
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                ClinicBot
              </h1>

              <p className="text-xs text-slate-500">
                Patient Intake Portal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-10">
        {/* Sidebar */}
        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9 9 0 100-18 9 9 0 000 18z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 7v5l3 2"
                  />
                </svg>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Pre-consultation
                </p>

                <p className="text-xs text-slate-500">
                  Takes a few minutes
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Progress
                </span>

                <span className="text-xs font-semibold text-teal-700">
                  {progress}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              What we collect
            </h2>

            <div className="space-y-3">
              {[
                "Main health concern",
                "Duration and symptoms",
                "Medical history",
                "Current medications",
                "Known allergies",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700">
                    {index + 1}
                  </div>

                  <p className="text-sm leading-5 text-slate-600">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-100 p-5">
            <div className="flex gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="mt-0.5 h-5 w-5 shrink-0 text-slate-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"
                />

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4"
                />
              </svg>

              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Your privacy matters
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your information is collected for
                  pre-consultation and clinical review.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Intake Area */}
        <section className="min-w-0">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Top section */}
            <div className="border-b border-slate-200 px-6 py-7 sm:px-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                  Patient Intake
                </span>

                <span className="text-xs text-slate-400">
                  Secure session
                </span>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Tell us about your health concern
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Answer a few simple questions before your
                consultation. Your responses will help the
                doctor understand your concerns more quickly.
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-8 sm:px-8 sm:py-10">
              {loading ? (
                <div className="flex min-h-[350px] flex-col items-center justify-center text-center">
                  <div className="mb-5 h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />

                  <h3 className="text-lg font-semibold text-slate-900">
                    Preparing your intake
                  </h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Please wait while we prepare your
                    secure questionnaire.
                  </p>
                </div>
              ) : completed ? (
                <div className="flex min-h-[350px] flex-col items-center justify-center text-center">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="h-8 w-8 text-teal-700"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 12l4 4L19 6"
                      />
                    </svg>
                  </div>

                  <span className="mb-3 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                    Intake complete
                  </span>

                  <h3 className="text-2xl font-bold text-slate-900">
                    Thank you
                  </h3>

                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                    Your pre-consultation information has
                    been successfully collected. A doctor
                    can review the information before your
                    consultation.
                  </p>

                  <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Next step
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      Please wait for the clinic staff or
                      doctor to continue with your
                      consultation.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Question */}
                  <div className="mx-auto max-w-3xl">
                    <div className="mb-8">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                        Question
                      </p>

                      <h3 className="text-xl font-semibold leading-8 text-slate-900 sm:text-2xl">
                        {question}
                      </h3>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                        <div className="flex gap-3">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="mt-0.5 h-5 w-5 shrink-0 text-red-600"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v4"
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 17h.01"
                            />

                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M10.3 3.7L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z"
                            />
                          </svg>

                          <p className="text-sm leading-6 text-red-700">
                            {error}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Form */}
                    <form onSubmit={submitAnswer}>
                      <label
                        htmlFor="answer"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Your answer
                      </label>

                      <textarea
                        id="answer"
                        value={answer}
                        onChange={(event) =>
                          setAnswer(event.target.value)
                        }
                        placeholder="Type your answer here..."
                        rows={6}
                        disabled={submitting}
                        className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-50 disabled:cursor-not-allowed disabled:bg-slate-50"
                      />

                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                          Please provide as much detail as you
                          can.
                        </p>

                        <p className="text-xs text-slate-400">
                          {answer.length} characters
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={
                          submitting ||
                          !answer.trim()
                        }
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto sm:min-w-40"
                      >
                        {submitting ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />

                            Saving...
                          </>
                        ) : (
                          <>
                            Continue

                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="h-4 w-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 12h14"
                              />

                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 6l6 6-6 6"
                              />
                            </svg>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Important notice */}
                  <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v4"
                        />

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 17h.01"
                        />

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M10.3 3.7L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z"
                        />
                      </svg>

                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Important
                        </p>

                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          ClinicBot is a pre-consultation
                          information and documentation tool.
                          It does not provide a medical
                          diagnosis or prescribe medication.
                          Your information is reviewed by a
                          healthcare professional.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              ClinicBot • Secure Pre-consultation Intake
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}