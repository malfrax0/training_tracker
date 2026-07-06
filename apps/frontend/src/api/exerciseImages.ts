import { useApiClient } from './client';

export interface ExerciseImageResult {
  id: string;
  url: string;
  description: string;
}

/**
 * Backend-proxied exercise photo search (see apps/backend/src/routes/exerciseImages.ts).
 * Runs server-side because the source site doesn't send CORS headers for
 * browser fetches; the backend fetches + parses the page and returns plain
 * JSON. No API key needed — it's a public search page, not a third-party API.
 */
export function useExerciseImagesApi() {
  const { apiFetch } = useApiClient();

  return {
    searchExerciseImages: (query: string) =>
      apiFetch<ExerciseImageResult[]>(`/api/exercise-image-search?q=${encodeURIComponent(query)}`),
  };
}
