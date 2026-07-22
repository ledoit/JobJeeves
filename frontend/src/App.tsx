import { useEffect, useMemo, useState } from "react";
import { analyzeResume, type AnalyzeResponse } from "./api";
import { clearBaseResume, loadBaseResume, saveBaseResume } from "./baseResume";

type ResumeMode = "upload" | "paste";

export default function App() {
  const [resumeMode, setResumeMode] = useState<ResumeMode>("upload");
  const [pdf, setPdf] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysisSource, setAnalysisSource] = useState<"groq" | "openai" | "local_heuristic">("groq");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [exportHint, setExportHint] = useState<string | null>(null);

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

  const hasResume = resumeMode === "upload" ? !!pdf : resumeText.trim().length > 0;

  const canSubmit = useMemo(() => {
    return hasResume && !loading;
  }, [hasResume, loading]);

  useEffect(() => {
    const saved = loadBaseResume();
    if (!saved) return;
    setResumeMode(saved.source === "upload" ? "upload" : "paste");
    setResumeText(saved.text);
    setSavedHint(
      saved.source === "upload"
        ? `Restored uploaded resume text from this session (${saved.filename ?? "PDF"}).`
        : "Restored pasted resume from this session.",
    );
  }, []);

  useEffect(() => {
    if (hasJobDescription && analysisSource === "local_heuristic") {
      setAnalysisSource("groq");
    }
  }, [analysisSource, hasJobDescription]);

  function persistBaseResume(text: string, source: ResumeMode, filename: string | null) {
    if (!text.trim()) {
      clearBaseResume();
      setSavedHint(null);
      return;
    }
    saveBaseResume({
      text,
      filename,
      source,
      updatedAt: new Date().toISOString(),
    });
    setSavedHint("Base resume saved for this browser session.");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasResume) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setExportHint(null);
    try {
      const r = await analyzeResume({
        pdf: resumeMode === "upload" ? pdf : null,
        resumeText: resumeMode === "paste" ? resumeText : undefined,
        jobDescription,
        analysisSource,
      });
      setResult(r);
      const storedText = r.resume_text?.trim() || resumeText.trim();
      if (resumeMode === "paste") {
        persistBaseResume(storedText, "paste", null);
      } else if (pdf && storedText) {
        persistBaseResume(storedText, "upload", pdf.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onPdfSelected(file: File | null) {
    setPdf(file);
    if (!file) return;
    setResumeMode("upload");
    setSavedHint(null);
  }

  async function copyTailoredResume(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setExportHint("Tailored resume copied to clipboard.");
    } catch {
      setExportHint("Could not copy to clipboard — try download instead.");
    }
  }

  function downloadTailoredResume(text: string) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tailored-resume.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setExportHint("Download started.");
  }

  const submitLabel = hasJobDescription
    ? loading
      ? "Tailoring..."
      : "Analyze & tailor"
    : loading
      ? "Analyzing..."
      : "Analyze resume";

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>JobJeeves</h1>
          <p className="sub">
            Set your base resume once (upload or paste), then analyze against any job description.
          </p>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Analyze</h2>
          <form onSubmit={onSubmit} className="form">
            <div className="segment">
              <button
                type="button"
                className={`segment-btn ${resumeMode === "upload" ? "active" : ""}`}
                onClick={() => setResumeMode("upload")}
              >
                Upload PDF
              </button>
              <button
                type="button"
                className={`segment-btn ${resumeMode === "paste" ? "active" : ""}`}
                onClick={() => setResumeMode("paste")}
              >
                Paste text
              </button>
            </div>

            {resumeMode === "upload" ? (
              <label className="label">
                Resume PDF
                <input
                  className="input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onPdfSelected(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <label className="label">
                Base resume
                <textarea
                  className="textarea"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your full resume text here..."
                  rows={12}
                />
              </label>
            )}

            {savedHint ? <p className="hint">{savedHint}</p> : null}

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
              {submitLabel}
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

              {result.tailored_resume?.trim() ? (
                <div className="block">
                  <div className="blockHeader">
                    <h3>Tailored resume</h3>
                    <div className="actionRow">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => copyTailoredResume(result.tailored_resume ?? "")}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => downloadTailoredResume(result.tailored_resume ?? "")}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  {exportHint ? <p className="hint">{exportHint}</p> : null}
                  <pre className="tailorOutput">{result.tailored_resume}</pre>
                </div>
              ) : result.analysis_mode === "job_match" ? (
                <p className="muted">No tailored resume returned for this run.</p>
              ) : null}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <span className="muted">
          Base resume persists in this browser tab session. PDF uploads still require extractable text.
        </span>
      </footer>
    </div>
  );
}
