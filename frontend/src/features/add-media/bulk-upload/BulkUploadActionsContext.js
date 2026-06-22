import { createContext, useContext } from 'react';

/**
 * Per-file upload actions (pause/resume/cancel/retry/reupload/delete) provided
 * by the page root so deeply nested file rows don't need prop drilling.
 */
const BulkUploadActionsContext = createContext(null);

export const BulkUploadActionsProvider = BulkUploadActionsContext.Provider;

export function useBulkUploadActions() {
	const context = useContext(BulkUploadActionsContext);
	if (!context) {
		throw new Error('useBulkUploadActions must be used within BulkUploadActionsProvider.');
	}
	return context;
}
