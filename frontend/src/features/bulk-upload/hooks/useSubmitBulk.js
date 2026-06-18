import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../shared/utils/api';
import { useBulkUploadConfig } from '../bulkUploadConfig';

/**
 * Submits the batch metadata. `action` is "draft" (save privately, keep out of
 * the review queue) or "submit" (validate via MediaForm + run the publish/review
 * path). Per-item validation errors come back keyed by friendly_token.
 */
export function useSubmitBulk() {
	const config = useBulkUploadConfig();

	return useMutation({
		mutationFn: async ({ action, items }) => {
			const response = await apiFetch(config.submitEndpoint, {
				method: 'POST',
				body: { action, items },
			});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) {
				const error = new Error(data.detail || 'Submission failed.');
				error.fieldErrors = data.errors || null;
				error.status = response.status;
				throw error;
			}
			return data;
		},
	});
}
