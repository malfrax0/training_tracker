import { useAuth0 } from '@auth0/auth0-react';

export function useApiClient() {
  const { getAccessTokenSilently } = useAuth0();

  async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await getAccessTokenSilently();
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  return { apiFetch };
}
