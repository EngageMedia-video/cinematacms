import { useMutation } from '@tanstack/react-query';
import { getCSRFToken } from '../../../shared/utils/api';
import { buildEditFormData, getMediaEditUrl } from '../buildSubmitItems';

/**
 * Submits each completed file per-file through the shared `edit_media` view —
 * the same path single-upload uses — as multipart FormData (so a chosen
 * thumbnail rides along as `uploaded_poster`). `action` is "draft" or "submit".
 *
 * Resolves with an aggregate `{ results, failed, succeeded }` (never rejects on
 * a per-file validation failure) so the caller can surface per-file errors and
 * still know which items went through. Field errors come back keyed by field
 * name, same as the single-upload edit response.
 */
export function useSubmitBulk() {
	return useMutation({
		mutationFn: async ({ action, files }) => {
			const csrfToken = getCSRFToken() ?? '';

			const results = await Promise.all(
				files.map(async (file) => {
					const body = buildEditFormData({
						metadata: file.metadata,
						posterFile: file.posterFile,
						action,
						csrfToken,
					});
					try {
						const response = await fetch(getMediaEditUrl(file.friendlyToken), {
							method: 'POST',
							body,
							credentials: 'same-origin',
							headers: { 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrfToken },
						});
						const data = await response.json().catch(() => null);
						if (response.ok && data?.success) {
							return { id: file.id, token: file.friendlyToken, ok: true, url: data.url };
						}
						return {
							id: file.id,
							token: file.friendlyToken,
							ok: false,
							fieldErrors: data?.errors || null,
							message: data?.detail || 'Submission failed.',
						};
					} catch {
						return {
							id: file.id,
							token: file.friendlyToken,
							ok: false,
							fieldErrors: null,
							message: 'Network error. Please try again.',
						};
					}
				})
			);

			return {
				results,
				succeeded: results.filter((result) => result.ok),
				failed: results.filter((result) => !result.ok),
			};
		},
	});
}
