import { fireEvent, render, screen } from '@testing-library/react';
import { FinalSettingsSection } from './FinalSettingsSection';

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'restricted', label: 'Restricted' },
	{ value: 'unlisted', label: 'Unlisted' },
];

function createEditState(overrides = {}) {
	return {
		enableComments: true,
		setEnableComments: vi.fn(),
		allowDownload: true,
		setAllowDownload: vi.fn(),
		mediaStatus: 'public',
		setMediaStatus: vi.fn(),
		password: '',
		setPassword: vi.fn(),
		errors: {},
		expireEnabled: false,
		setExpireEnabled: vi.fn(),
		startDate: '',
		setStartDate: vi.fn(),
		endDate: '',
		setEndDate: vi.fn(),
		isEncrypted: false,
		setIsEncrypted: vi.fn(),
		...overrides,
	};
}

function renderSection(editState = createEditState()) {
	return render(
		<FinalSettingsSection
			config={{
				statusOptions: STATUS_OPTIONS,
				permissions: { canUseEncryption: false },
				media: {},
			}}
			editState={editState}
		/>
	);
}

describe('FinalSettingsSection', () => {
	it('hides visibility expiration when the current status is private', () => {
		renderSection(createEditState({ mediaStatus: 'private', expireEnabled: true }));

		expect(screen.queryByText('Set Visibility Expiration')).not.toBeInTheDocument();
	});

	it('clears visibility expiration when private status is selected', () => {
		const editState = createEditState({ mediaStatus: 'public', expireEnabled: true });
		renderSection(editState);

		fireEvent.click(screen.getByRole('radio', { name: 'Private' }));

		expect(editState.setExpireEnabled).toHaveBeenCalledWith(false);
		expect(editState.setMediaStatus).toHaveBeenCalledWith('private');
	});
});
