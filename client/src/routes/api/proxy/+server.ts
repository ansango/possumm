import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    throw error(400, 'URL parameter is required');
  }

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      throw error(response.status, `Failed to fetch: ${response.statusText}`);
    }

    // Forward the response with appropriate headers
    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw error(500, `Proxy error: ${message}`);
  }
};
