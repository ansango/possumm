import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { API_CONFIG } from '$lib/config/api';

/**
 * GET /api/downloads/[id]/logs - Get logs for a specific download with pagination
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const { id } = params;
	const page = url.searchParams.get('page') || '1';
	const limit = url.searchParams.get('limit') || '50';

	try {
		const response = await fetch(
			`${API_CONFIG.BASE_URL}/downloads/${id}/logs?page=${page}&limit=${limit}`
		);

		if (!response.ok) {
			throw error(response.status, `Failed to fetch logs: ${response.statusText}`);
		}

		const data = await response.json();
		return json(data);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw error(500, `Failed to fetch logs: ${message}`);
	}
};
