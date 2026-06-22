import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import bulkUploadQueryClient from '../queryClient';
import { BulkUploadConfigProvider, readBulkUploadConfig } from '../bulkUploadConfig';
import { BulkUploadInner } from './BulkUploadInner';

export default function BulkUploadPage({ config: configOverride, embedded = false }) {
	// Standalone /bulk_upload reads its config from the page's JSON script block;
	// when hosted as the Bulk Upload tab, AddMediaPage passes overrides (trusted
	// flag, admin settings, per-role limit) sourced from window.MediaCMS and marks
	// the page embedded (so the duplicate header/policy/container are suppressed).
	const config = useMemo(() => {
		const merged = { ...readBulkUploadConfig(), embedded };
		if (configOverride) {
			for (const [key, value] of Object.entries(configOverride)) {
				if (value !== undefined) {
					merged[key] = value;
				}
			}
		}
		return merged;
	}, [configOverride, embedded]);

	return (
		<QueryClientProvider client={bulkUploadQueryClient}>
			<BulkUploadConfigProvider value={config}>
				<BulkUploadInner />
			</BulkUploadConfigProvider>
		</QueryClientProvider>
	);
}
