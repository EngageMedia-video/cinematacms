import { render, screen } from '@testing-library/react';
import { BulkUploadConfigProvider, BULK_UPLOAD_CONFIG_DEFAULTS } from '../bulkUploadConfig';
import { UploadTabs } from './UploadTabs';

describe('UploadTabs', () => {
	it('renders bulk as the active secondary segment', () => {
		render(
			<BulkUploadConfigProvider value={{ ...BULK_UPLOAD_CONFIG_DEFAULTS, singleUploadUrl: '/upload' }}>
				<UploadTabs />
			</BulkUploadConfigProvider>
		);

		expect(screen.getByRole('link', { name: /single film upload/i })).toHaveAttribute('href', '/upload');
		expect(screen.getByText('Bulk Upload')).toHaveAttribute('aria-current', 'page');
		expect(screen.getByText('Bulk Upload')).toHaveClass('bg-bg-primary');
	});
});
