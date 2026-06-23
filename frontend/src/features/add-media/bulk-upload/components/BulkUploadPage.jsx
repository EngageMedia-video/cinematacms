import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import bulkUploadQueryClient from '../queryClient';
import { BulkUploadConfigProvider, readBulkUploadConfig } from '../bulkUploadConfig';
import { BulkUploadInner } from './BulkUploadInner';

export default function BulkUploadPage({ config: configOverride }) {
	// Hosted as the Bulk Upload tab inside AddMediaPage, which passes config
	// overrides (trusted flag, admin settings, per-role limit, move-to-single
	// callback) sourced from window.MediaCMS; defaults fill in the rest.
	const config = useMemo(() => {
		const merged = { ...readBulkUploadConfig() };
		if (configOverride) {
			for (const [key, value] of Object.entries(configOverride)) {
				if (value !== undefined) {
					merged[key] = value;
				}
			}
		}
		return merged;
	}, [configOverride]);

	return (
		<QueryClientProvider client={bulkUploadQueryClient}>
			<BulkUploadConfigProvider value={config}>
				<BulkUploadInner />
			</BulkUploadConfigProvider>
		</QueryClientProvider>
	);
}
