import { useQuery, useQueryClient } from '@tanstack/react-query';

export const REPLACEMENT_UPLOAD_QUERY_KEY = ['edit-media', 'replacement-upload'];

export const EMPTY_REPLACEMENT_UPLOAD_STATE = {
	phase: 'idle',
	name: '',
	progress: 0,
	error: '',
	size: null,
};

export function useReplacementUploadState() {
	const queryClient = useQueryClient();
	const { data: status = EMPTY_REPLACEMENT_UPLOAD_STATE } = useQuery({
		queryKey: REPLACEMENT_UPLOAD_QUERY_KEY,
		queryFn: () => EMPTY_REPLACEMENT_UPLOAD_STATE,
		initialData: EMPTY_REPLACEMENT_UPLOAD_STATE,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	function setStatus(nextStatus) {
		queryClient.setQueryData(REPLACEMENT_UPLOAD_QUERY_KEY, (current) => {
			const base = current || EMPTY_REPLACEMENT_UPLOAD_STATE;
			return typeof nextStatus === 'function' ? nextStatus(base) : nextStatus;
		});
	}

	function resetStatus() {
		setStatus(EMPTY_REPLACEMENT_UPLOAD_STATE);
	}

	return {
		status,
		setStatus,
		resetStatus,
		uploadBusy: ['uploading', 'paused'].includes(status.phase),
	};
}
