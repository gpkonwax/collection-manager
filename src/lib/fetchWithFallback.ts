export async function fetchWithFallback(
  endpoints: string[],
  path: string,
  options?: RequestInit,
  timeout: number = 15000
): Promise<Response> {
  let lastError: Error | null = null;

  for (const baseUrl of endpoints) {
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
