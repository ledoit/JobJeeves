import { useEffect, useMemo, useState } from "react";
import { analyzeResume, type AnalyzeResponse } from "./api";

export default function App() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [analysisSource, setAnalysisSource] = useState<"groq" | "openai" | "local_heuristic">("groq");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const hasJobDescription = jobDescription.trim().length > 0;
  const sourceOptions = hasJobDescription
    ? ([
        { value: "groq", label: "Groq (JD mode)" },
        { value: "openai", label: "OpenAI (JD mode)" },
      ] as const)
    : ([
        { value: "groq", label: "Groq (resume-only)" },
        { value: "openai", label: "OpenAI (resume-only)" },
        { value: "local_heuristic", label: "Local heuristic (resume-only, no API)" },
      ] as const);

  const canSubmit = useMemo(() => {
    return !!pdf && !loading;
  }, [pdf, loading]);

  useEffect(() => {
    if (hasJobDescription && analysisSource === "local_heuristic") {
      setAnalysisSource("groq");
    }
  }, [analysisSource, hasJobDescription]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdf) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await analyzeResume({ pdf, jobDescription, analysisSource });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>JobJeeves</h1>
          <p className="sub">
            Upload your resume PDF and optionally paste a job description.
            Get either a job-match analysis or a resume-only review.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Analyze</h2>
          <form onSubmit={onSubmit} className="form">
            <label className="label">
              Resume PDF
              <input
                className="input"
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="label">
              Job description (optional)
              <textarea
                className="textarea"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here (or leave blank for resume-only mode)..."
                rows={10}
              />
            </label>

            <label className="label">
              Analysis source
              <select
                className="input"
                value={analysisSource}
                onChange={(e) =>
                  setAnalysisSource(e.target.value as "groq" | "openai" | "local_heuristic")
                }
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="button" disabled={!canSubmit} type="submit">
              {loading ? "Analyzing..." : "Analyze resume"}
            </button>

            {error ? <div className="error">{error}</div> : null}
          </form>
        </section>

        <section className="card">
          <h2>Results</h2>
          {!result ? (
            <p className="muted">Run an analysis to see results.</p>
          ) : (
            <div className="results">
              <div className="scoreRow">
                <div className="score">{result.match_score}</div>
                <div>
                  <div className="scoreLabel">
                    {result.analysis_mode === "resume_only"
                      ? "Resume readiness score (0–100)"
                      : "Match score (0–100)"}
                  </div>
                  <div className="muted">
                    Analysis ID: {result.analysis_id} · Engine: {result.analysis_engine}
                  </div>
                </div>
              </div>

              {result.short_summary ? (
                <div className="block">
                  <h3>Summary</h3>
                  <p>{result.short_summary}</p>
                </div>
              ) : null}

              <div className="cols">
                <div className="block">
                  <h3>
                    {result.analysis_mode === "resume_only"
                      ? "Potentially missing/underemphasized keywords"
                      : "Missing keywords"}
                  </h3>
                  {result.missing_keywords.length ? (
                    <ul>
                      {result.missing_keywords.map((k) => (
                        <li key={k}>{k}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">None detected.</p>
                  )}
                </div>

                <div className="block">
                  <h3>Strengths</h3>
                  {result.strengths.length ? (
                    <ul>
                      {result.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No strengths returned.</p>
                  )}
                </div>
              </div>

              <div className="block">
                <h3>Improvement suggestions</h3>
                {result.improvement_suggestions.length ? (
                  <ol>
                    {result.improvement_suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">No suggestions returned.</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span className="muted">
          Tip: scanned/image-only PDFs won’t extract well without OCR.
        </span>
      </footer>
    </div>
  );
}

