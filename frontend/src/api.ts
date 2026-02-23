export type AnalyzeResponse = {
  analysis_id: string;
  match_score: number;
  missing_keywords: string[];
  improvement_suggestions: string[];
  strengths: string[];
  short_summary: string;
};

export async function analyzeResume(params: {
  pdf: File;
  jobDescription: string;
}): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", params.pdf);
  form.append("job_description", params.jobDescription);

  const res = await fetch("/api/analyze", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as AnalyzeResponse;
}

