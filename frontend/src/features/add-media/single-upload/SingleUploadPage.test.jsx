import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SingleUploadPage } from './SingleUploadPage';
import useSingleUploadStore from './useSingleUploadStore';

const TEST_LICENSES = [
	{ id: '1', title: 'CC BY 4.0 - Attribution', allowCommercial: 'yes', allowModifications: 'yes' },
	{
		id: '2',
		title: 'CC BY-SA 4.0 - Attribution-ShareAlike',
		allowCommercial: 'yes',
		allowModifications: 'sharealike',
	},
	{ id: '3', title: 'CC BY-NC 4.0 - Attribution-NonCommercial', allowCommercial: 'no', allowModifications: 'yes' },
	{
		id: '4',
		title: 'CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike',
		allowCommercial: 'no',
		allowModifications: 'sharealike',
	},
	{ id: '5', title: 'CC BY-ND 4.0 - Attribution-NoDerivatives', allowCommercial: 'yes', allowModifications: 'no' },
	{
		id: '6',
		title: 'CC BY-NC-ND 4.0 - Attribution-NonCommercial-NoDerivatives',
		allowCommercial: 'no',
		allowModifications: 'no',
	},
];

// SingleUploadPage now loads form options from useTaxonomies (GET bulk_options).
// Mock the hook so the option lists are available synchronously; the API shape
// uses codes for language/country and ids for the taxonomies/licenses.
const taxonomyOptions = {
	categories: [{ id: 'documentary', title: 'Documentary' }],
	topics: [{ id: 'culture', title: 'Culture' }],
	content_sensitivities: [],
	languages: [{ code: 'en', title: 'English' }],
	countries: [{ code: 'id', title: 'Indonesia' }],
	licenses: TEST_LICENSES,
};

vi.mock('../../shared/components/upload-media', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		useTaxonomies: () => ({ options: taxonomyOptions }),
	};
});

describe('SingleUploadPage', () => {
	beforeEach(() => {
		useSingleUploadStore.getState().reset();
	});

	function renderUploadedPage(props = {}) {
		return render(<SingleUploadPage hasUploadedMedia uploadedMedia={{ editUrl: '/media/test/edit' }} {...props} />);
	}

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('shows the last selected thumbnail file after choosing an image', () => {
		vi.stubGlobal('URL', {
			createObjectURL: vi.fn(() => 'blob:thumbnail-preview'),
			revokeObjectURL: vi.fn(),
		});
		renderUploadedPage();

		const thumbnailInput = screen.getByLabelText('Choose thumbnail image');
		const file = new File(['poster'], 'poster.png', { type: 'image/png' });

		expect(thumbnailInput).toHaveAttribute('accept', 'image/*');
		expect(thumbnailInput).toHaveAttribute('name', 'uploaded_poster');
		expect(thumbnailInput).not.toHaveAttribute('multiple');

		fireEvent.change(thumbnailInput, { target: { files: [file] } });

		expect(screen.getByText('Last selected: poster.png')).toBeInTheDocument();
		expect(screen.getByRole('img', { name: 'Selected thumbnail preview' })).toHaveAttribute(
			'src',
			'blob:thumbnail-preview'
		);
	});

	it('updates the hidden license field from the dialog choices', () => {
		renderUploadedPage();

		const licenseField = document.querySelector('input[name="custom_license"]');
		const noLicenseField = screen.getByRole('checkbox', { name: /All Rights Reserved/ });

		expect(licenseField).toHaveValue('None');
		expect(noLicenseField).toBeChecked();

		const chooseLicenseButton = screen.getByRole('button', { name: 'Choose License' });
		expect(chooseLicenseButton).toHaveClass('text-text-accent');

		fireEvent.click(chooseLicenseButton);

		expect(screen.getByRole('dialog', { name: 'Choose Creative Commons license' })).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('Allow commercial uses of your work? No'));
		fireEvent.click(screen.getByLabelText('Allow modifications of your work? Yes, as long as others share alike'));
		fireEvent.click(screen.getByRole('button', { name: 'Update License' }));

		expect(licenseField).toHaveValue('4');
		expect(noLicenseField).not.toBeChecked();
		expect(screen.getByText('CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike')).toBeInTheDocument();
	});

	it('limits year produced to four characters', async () => {
		const user = userEvent.setup();
		renderUploadedPage();

		const yearInput = screen.getByLabelText('Year Produced');

		await user.type(yearInput, '20245');

		expect(yearInput).toHaveValue('2024');
	});

	it('enables comments and downloads by default', () => {
		renderUploadedPage();

		expect(screen.getByRole('checkbox', { name: 'Enable Comments' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Allow Download' })).toBeChecked();
	});

	it('keeps admin settings hidden for non-admin uploads and submits reported times as zero', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage();

		expect(screen.queryByRole('heading', { name: 'Admin Settings' })).not.toBeInTheDocument();
		expect(screen.queryByRole('checkbox', { name: 'Featured' })).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Reported Times')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		const submittedBody = fetchMock.mock.calls[0][1].body;
		expect(submittedBody.get('reported_times')).toBe('0');
		expect(submittedBody.get('featured')).toBeNull();
	});

	it('shows admin settings for admins and submits featured and reported times', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage({ canUseAdminSettings: true });

		expect(screen.getByRole('heading', { name: 'Admin Settings' })).toBeInTheDocument();

		await user.click(screen.getByRole('checkbox', { name: 'Featured' }));
		await user.clear(screen.getByLabelText('Reported Times'));
		await user.type(screen.getByLabelText('Reported Times'), '3');
		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const submittedBody = fetchMock.mock.calls[0][1].body;

		expect(submittedBody.get('featured')).toBe('on');
		expect(submittedBody.get('reported_times')).toBe('3');
	});

	it('submits stream protection as the HLS encryption field', () => {
		renderUploadedPage();

		const streamProtection = document.querySelector('input[name="is_encrypted"]');

		expect(screen.getByText('Stream Protection')).toBeInTheDocument();
		// HLS encryption is opt-in: the checkbox is present but off by default.
		expect(streamProtection).not.toBeChecked();
	});

	it('shows a password field with visibility toggle for restricted status', async () => {
		const user = userEvent.setup();
		renderUploadedPage({ canPublishDirectly: true });

		expect(screen.queryByLabelText('Enter Password')).not.toBeInTheDocument();

		await user.click(screen.getByLabelText('Restricted'));

		const passwordInput = screen.getByLabelText('Enter Password');
		expect(passwordInput).toHaveAttribute('type', 'password');

		await user.click(screen.getByRole('button', { name: 'Show' }));
		expect(passwordInput).toHaveAttribute('type', 'text');

		await user.click(screen.getByRole('button', { name: 'Hide' }));
		expect(passwordInput).toHaveAttribute('type', 'password');
	});

	it('submits the details form through fetch and maps server field errors', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				errors: {
					summary: ['Keep this under 80 words.'],
				},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage({ canPublishDirectly: true });

		await user.type(screen.getByLabelText('Synopsis'), 'A short synopsis.');
		await user.type(screen.getByLabelText('Year Produced'), '2024');

		await user.click(screen.getByRole('button', { name: 'Select media language' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

		await user.click(screen.getByRole('button', { name: 'Select media country' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Indonesia' }));

		await user.click(screen.getByLabelText('Documentary'));
		await user.click(screen.getByLabelText('Culture'));

		const thumbnail = new File(['poster'], 'poster.png', { type: 'image/png' });
		fireEvent.change(screen.getByLabelText('Choose thumbnail image'), { target: { files: [thumbnail] } });

		await user.click(screen.getByRole('button', { name: 'Share Media' }));
		await user.click(screen.getByRole('button', { name: 'Yes, Proceed' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const submittedBody = fetchMock.mock.calls[0][1].body;

		expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/media/test/edit', {
			method: 'POST',
			body: expect.any(FormData),
			credentials: 'same-origin',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
		});
		expect(submittedBody.get('uploaded_poster')).toBe(thumbnail);
		expect(submittedBody.get('thumbnail')).toBeNull();
		expect(submittedBody.get('action')).toBe('submit');
		expect(await screen.findByText('summary: Keep this under 80 words.')).toBeInTheDocument();
	});

	it('saves draft without running share validation', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage();

		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const submittedBody = fetchMock.mock.calls[0][1].body;

		expect(submittedBody.get('action')).toBe('draft');
		expect(
			screen.queryByText('Please fill in all required fields before sharing your media.')
		).not.toBeInTheDocument();
	});

	it('submits for review with the submit action', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				errors: {
					summary: ['Needs review.'],
				},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage();

		await user.type(screen.getByLabelText('Synopsis'), 'A short synopsis.');
		await user.type(screen.getByLabelText('Year Produced'), '2024');

		await user.click(screen.getByRole('button', { name: 'Select media language' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'English' }));

		await user.click(screen.getByRole('button', { name: 'Select media country' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Indonesia' }));

		await user.click(screen.getByLabelText('Documentary'));
		await user.click(screen.getByLabelText('Culture'));

		await user.click(screen.getByRole('button', { name: 'Share Media' }));
		await user.click(screen.getByRole('button', { name: 'Yes, Proceed' }));
		await user.click(screen.getByRole('button', { name: 'Yes, Submit' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		expect(fetchMock.mock.calls[0][1].body.get('action')).toBe('submit');
	});
});
