import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import bulkUploadQueryClient from '../queryClient';
import { BulkUploadConfigProvider, readBulkUploadConfig } from '../bulkUploadConfig';
import { BulkUploadInner } from './BulkUploadInner';

export default function BulkUploadPage() {
	const config = useMemo(() => readBulkUploadConfig(), []);

	return (
		<QueryClientProvider client={bulkUploadQueryClient}>
			<BulkUploadConfigProvider value={config}>
				<BulkUploadInner />
			</BulkUploadConfigProvider>
		</QueryClientProvider>
	);
}
