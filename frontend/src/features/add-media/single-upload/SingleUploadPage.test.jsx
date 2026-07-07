import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// SingleUploadPage now loads form options from useTaxonomies (GET upload_options).
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

vi.mock('../../shared/components/UploadMedia', async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		useTaxonomies: () => ({ options: taxonomyOptions }),
	};
});

class MockImage {
	static instances = [];

	constructor() {
		this.naturalHeight = 450;
		MockImage.instances.push(this);
	}

	set src(value) {
		this._src = value;
	}

	get src() {
		return this._src;
	}
}

const OriginalImage = global.Image;

describe('SingleUploadPage', () => {
	beforeEach(() => {
		useSingleUploadStore.getState().reset();
		MockImage.instances = [];
	});

	function renderUploadedPage(props = {}) {
		return render(<SingleUploadPage hasUploadedMedia uploadedMedia={{ editUrl: '/media/test/edit' }} {...props} />);
	}

	afterEach(() => {
		global.Image = OriginalImage;
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

	it('selects a year from the popover picker', async () => {
		const user = userEvent.setup();
		renderUploadedPage();

		await user.click(screen.getByRole('button', { name: 'Choose' }));

		const yearButton = screen.getByRole('button', { name: '2024' });
		await user.click(yearButton);

		expect(document.querySelector('input[name="year_produced"]')).toHaveValue('2024');
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

	it('renders the stream protection checkbox unchecked by default', () => {
		renderUploadedPage();

		const encryptionCheckbox = screen.getByRole('checkbox', { name: /Encrypt this video/ });

		expect(encryptionCheckbox).not.toBeChecked();
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

	it('flags a restricted password shorter than the minimum while typing', async () => {
		const user = userEvent.setup();
		renderUploadedPage({ canPublishDirectly: true });

		await user.click(screen.getByLabelText('Restricted'));
		await user.type(screen.getByLabelText('Enter Password'), 'short');

		expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();

		await user.type(screen.getByLabelText('Enter Password'), 'password');

		expect(screen.queryByText('Password must be at least 8 characters.')).not.toBeInTheDocument();
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

		await user.type(screen.getByLabelText('Title'), 'A short title.');
		await user.type(screen.getByLabelText('Synopsis'), 'A short synopsis.');
		await user.click(screen.getByRole('button', { name: 'Choose' }));
		await user.click(screen.getByRole('button', { name: '2024' }));

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

		expect(submittedBody.get('is_reviewed')).toBeNull();
		expect(submittedBody.get('action')).toBe('draft');
		expect(
			screen.queryByText('Please fill in all required fields before sharing your media.')
		).not.toBeInTheDocument();
	});

	it('notifies the parent before redirecting after a successful submit', async () => {
		const user = userEvent.setup();
		const onSubmitSuccess = vi.fn();
		const assignMock = vi.fn();
		vi.stubGlobal('location', { ...window.location, assign: assignMock });
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ success: true, url: '/user/me/media' }),
			})
		);

		renderUploadedPage({
			onSubmitSuccess,
			uploadedMedia: {
				editUrl: '/media/test/edit',
				friendlyToken: 'submitted-token',
			},
		});

		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(onSubmitSuccess).toHaveBeenCalledWith('submitted-token'));
		expect(assignMock).toHaveBeenCalledWith('/user/me/media');
	});

	it('marks direct-publish uploads as reviewed by default', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage({ canPublishDirectly: true });

		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const submittedBody = fetchMock.mock.calls[0][1].body;

		expect(submittedBody.get('is_reviewed')).toBe('on');
	});

	it('submits a selected video frame as thumbnail_time', async () => {
		const user = userEvent.setup();
		global.Image = MockImage;
		Element.prototype.scrollIntoView = vi.fn();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage({
			uploadedMedia: {
				duration: 80,
				editUrl: '/media/test/edit',
				friendlyToken: 'abc123',
				spritesUrl: '/sprites.jpg',
			},
		});

		await user.click(screen.getByRole('tab', { name: 'CHOOSE FROM VIDEO' }));
		act(() => {
			MockImage.instances[0].onload();
		});
		await user.click(await screen.findByRole('button', { name: /0:20/i }));
		await user.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		const submittedBody = fetchMock.mock.calls[0][1].body;

		expect(submittedBody.get('thumbnail_time')).toBe('20');
		expect(submittedBody.get('uploaded_poster')).toBeNull();
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

		await user.type(screen.getByLabelText('Title'), 'A short title.');
		await user.type(screen.getByLabelText('Synopsis'), 'A short synopsis.');
		await user.click(screen.getByRole('button', { name: 'Choose' }));
		await user.click(screen.getByRole('button', { name: '2024' }));

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
		expect(fetchMock.mock.calls[0][1].body.get('is_reviewed')).toBeNull();
	});
});
