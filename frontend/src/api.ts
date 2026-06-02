export type AnalyzeResponse = {
  analysis_id: string;
  match_score: number;
  analysis_mode: "job_match" | "resume_only";
  analysis_engine: string;
  missing_keywords: string[];
  improvement_suggestions: string[];
  strengths: string[];
  short_summary: string;
};

export async function analyzeResume(params: {
  pdf: File;
  jobDescription?: string;
  analysisSource?: "groq" | "openai" | "local_heuristic";
}): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", params.pdf);
  form.append("job_description", params.jobDescription?.trim() ?? "");
  if (params.analysisSource) {
    form.append("analysis_source", params.analysisSource);
  }

  // Use VITE_API_URL environment variable for production (Vercel)
  // Falls back to /api for local dev with Vite proxy
  const apiUrl = import.meta.env.VITE_API_URL || "";
  const endpoint = apiUrl ? `${apiUrl}/api/analyze` : "/api/analyze";

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as AnalyzeResponse;
}

