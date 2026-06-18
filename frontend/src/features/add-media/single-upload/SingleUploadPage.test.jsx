import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SingleUploadPage } from './SingleUploadPage';
import useSingleUploadStore from './useSingleUploadStore';

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

		fireEvent.click(screen.getByRole('button', { name: 'Choose License' }));

		expect(screen.getByRole('dialog', { name: 'Choose Creative Commons license' })).toBeInTheDocument();

		fireEvent.click(screen.getByLabelText('Allow commercial uses of your work? No'));
		fireEvent.click(screen.getByLabelText('Allow modifications of your work? Yes, as long as others share alike'));
		fireEvent.click(screen.getByRole('button', { name: 'Update License' }));

		expect(licenseField).toHaveValue('4');
		expect(noLicenseField).not.toBeChecked();
		expect(screen.getByText('CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike')).toBeInTheDocument();
	});

	it('submits the details form through fetch and maps server field errors', async () => {
		const user = userEvent.setup();
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			json: async () => ({
				errors: {
					summary: ['Keep this under 60 words.'],
				},
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		renderUploadedPage({
			canPublishDirectly: true,
			mediaLanguages: [{ label: 'English', value: 'en' }],
			mediaCountries: [{ label: 'Indonesia', value: 'id' }],
			categories: [{ label: 'Documentary', value: 'documentary' }],
			topics: [{ label: 'Culture', value: 'culture' }],
		});

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
		expect(await screen.findByText('summary: Keep this under 60 words.')).toBeInTheDocument();
	});
});
