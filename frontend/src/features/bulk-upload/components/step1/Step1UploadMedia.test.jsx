import { render, screen } from '@testing-library/react';
import { BulkUploadActionsProvider } from '../../BulkUploadActionsContext';
import { BULK_UPLOAD_CONFIG_DEFAULTS, BulkUploadConfigProvider } from '../../bulkUploadConfig';
import useBulkUploadStore from '../../useBulkUploadStore';
import { Step1UploadMedia } from './Step1UploadMedia';

function renderStep1() {
	return render(
		<BulkUploadConfigProvider value={{ ...BULK_UPLOAD_CONFIG_DEFAULTS, maxFiles: 2 }}>
			<BulkUploadActionsProvider value={{ addFiles: vi.fn() }}>
				<Step1UploadMedia files={[]} />
			</BulkUploadActionsProvider>
		</BulkUploadConfigProvider>
	);
}

beforeEach(() => {
	useBulkUploadStore.getState().reset();
});

describe('Step1UploadMedia', () => {
	it('places the choose-media dropzone inside the bulk media upload card', () => {
		renderStep1();

		const card = screen.getByRole('heading', { name: 'Bulk Media Upload' }).closest('section');
		expect(card).toHaveClass('bg-bg-surface');
		expect(card).toContainElement(screen.getByRole('button', { name: 'CHOOSE MEDIA' }));
		expect(card).toHaveTextContent('You can upload 2 files max');
	});
});
