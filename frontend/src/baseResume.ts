export type BaseResume = {
  text: string;
  filename: string | null;
  source: "paste" | "upload";
  updatedAt: string;
};

const STORAGE_KEY = "jobjeeves-base-resume-v1";

export function loadBaseResume(): BaseResume | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BaseResume;
    if (!parsed.text?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBaseResume(resume: BaseResume): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
}

export function clearBaseResume(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
