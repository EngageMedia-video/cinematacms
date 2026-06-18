import { useMutation } from '@tanstack/react-query';

/**
 * Submits the single-upload edit form after the video upload completes. The
 * payload stays as FormData because the thumbnail field can include a file.
 */
export function useSubmitSingle() {
	return useMutation({
		mutationFn: async ({ form, thumbnailFile }) => {
			const body = new FormData(form);

			body.delete('uploaded_poster');
			if (thumbnailFile) {
				body.set('uploaded_poster', thumbnailFile);
			}

			const response = await fetch(form.action, {
				method: 'POST',
				body,
				credentials: 'same-origin',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
			});
			const data = await response.json().catch(() => null);

			if (response.ok && data?.success) {
				return data;
			}

			if (data?.errors) {
				const error = new Error('Please review your inputs and try again.');
				error.fieldErrors = data.errors;
				error.status = response.status;
				throw error;
			}

			throw new Error(`Unexpected response: ${response.status}`);
		},
	});
}
