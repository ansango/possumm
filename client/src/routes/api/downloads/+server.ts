import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_CONFIG } from '$lib/config/api';

/**
 * POST /api/downloads - Enqueue a new download
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();

    const response = await fetch(`${API_CONFIG.BASE_URL}/downloads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw error(
        response.status,
        errorData.message || `Failed to enqueue download: ${response.statusText}`
      );
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw error(500, `Failed to enqueue download: ${message}`);
  }
};
