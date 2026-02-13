import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_CONFIG } from '$lib/config/api';

/**
 * GET /api/downloads/[id] - Get a single download by ID
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
  const { id } = params;

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/downloads/${id}`);

    if (!response.ok) {
      throw error(response.status, `Failed to fetch download: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw error(500, `Failed to fetch download: ${message}`);
  }
};
