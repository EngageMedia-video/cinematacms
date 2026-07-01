import { useMutation } from '@tanstack/react-query';

export function applyEditMediaPayloadFields(body, { thumbnailFile, thumbnailTime, visibilityExpiration } = {}) {
	body.delete('uploaded_poster');
	body.delete('thumbnail_time');
	body.delete('visibility_start');
	body.delete('visibility_end');

	if (thumbnailFile) {
		body.set('uploaded_poster', thumbnailFile);
	} else if (thumbnailTime != null && thumbnailTime !== '') {
		body.set('thumbnail_time', String(thumbnailTime));
	}

	if (visibilityExpiration) {
		body.set('visibility_start', visibilityExpiration.expireEnabled ? visibilityExpiration.startDate || '' : '');
		body.set('visibility_end', visibilityExpiration.expireEnabled ? visibilityExpiration.endDate || '' : '');
	}
}

export function useSubmitEditMedia() {
	return useMutation({
		mutationFn: async ({ form, thumbnailFile, thumbnailTime, visibilityExpiration }) => {
			const body = new FormData(form);
			body.set('action', 'submit');
			applyEditMediaPayloadFields(body, { thumbnailFile, thumbnailTime, visibilityExpiration });

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
