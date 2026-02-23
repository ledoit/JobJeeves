import { useMemo, useState } from "react";
import { analyzeResume, type AnalyzeResponse } from "./api";

export default function App() {
  const [pdf, setPdf] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const canSubmit = useMemo(() => {
    return !!pdf && jobDescription.trim().length >= 20 && !loading;
  }, [pdf, jobDescription, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pdf) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await analyzeResume({ pdf, jobDescription });
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
            Upload your resume PDF, paste a job description, and get a match
            score + missing keywords + improvements.
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
              Job description
              <textarea
                className="textarea"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the full job description here..."
                rows={10}
              />
            </label>

            <button className="button" disabled={!canSubmit} type="submit">
              {loading ? "Analyzing..." : "Analyze match"}
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
                  <div className="scoreLabel">Match score (0–100)</div>
                  <div className="muted">Analysis ID: {result.analysis_id}</div>
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
                  <h3>Missing keywords</h3>
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

