// Fallback fetch utility for AtomicAssets API reliability

export async function fetchWithFallback(
  endpoints: string[],
  path: string,
  options?: RequestInit,
  timeout: number = 15000
): Promise<Response> {
  let lastError: Error | null = null;

  for (const baseUrl of endpoints) {
    // Attempt up to 2 tries per endpoint (retry once on timeout)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return response;
        }
        
        // If response is not ok, don't retry same endpoint — try next
        console.warn(`Endpoint ${baseUrl} returned ${response.status}, trying next...`);
        break;
      } catch (error) {
        lastError = error as Error;
        const isTimeout = (error as Error).name === 'AbortError';
        
        if (isTimeout && attempt === 0) {
          console.warn(`Endpoint ${baseUrl} timed out, retrying after 1s...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        
        console.warn(`Endpoint ${baseUrl} failed:`, (error as Error).message);
        break;
      }
    }
  }

  throw lastError || new Error('All API endpoints failed');
}

// Helper to build URL with query params
export function buildApiUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, 'https://placeholder.com');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.pathname + url.search;
}
