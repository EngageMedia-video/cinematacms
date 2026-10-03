import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditMediaPage } from './EditMediaPage';
import editMediaQueryClient from './queryClient';

const PAGE_CONFIG = {
	editUrl: '/edit?m=abc123',
	csrfToken: 'test-token',
	media: {
		friendlyToken: 'abc123',
		title: 'River Stories',
		summary: 'A short film about a river.',
		description: 'Original credits.',
		yearProduced: '2020',
		mediaLanguage: 'en',
		mediaCountry: 'ID',
		category: ['1', '3'],
		topics: ['2'],
		mediaStatus: 'public',
	},
	options: {
		categories: [
			{ value: '1', label: 'Documentary' },
			{ value: '3', label: 'Fiction' },
		],
		topics: [{ value: '2', label: 'Environment' }],
		mediaLanguages: [{ value: 'en', label: 'English' }],
		mediaCountries: [{ value: 'ID', label: 'Indonesia' }],
		licenses: [{ id: '1', title: 'CC BY 4.0 - Attribution', allowCommercial: 'yes', allowModifications: 'yes' }],
	},
};

function leaveWarningShown() {
	const event = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(event);
	return event.defaultPrevented;
}

// Stands in for the Fine Uploader script that the page template loads.
class InstantUploader {
	constructor({ callbacks }) {
		this.callbacks = callbacks;
	}

	addFiles([file]) {
		this.callbacks.onSubmit(0, file.name);
		this.callbacks.onComplete(0, file.name, { success: true });
	}

	getFile() {
		return null;
	}
}

class StalledUploader {
	constructor({ callbacks }) {
		this.callbacks = callbacks;
	}

	addFiles([file]) {
		this.callbacks.onSubmit(0, file.name);
	}

	pauseUpload() {
		return true;
	}
}

function renderWithReplacementUploader(Uploader) {
	window.MediaCMS = {
		editMediaPage: { ...PAGE_CONFIG, permissions: { canReplaceMedia: true }, uploadEndpoint: '/upload/' },
	};
	window.qq = { FineUploaderBasic: Uploader };
	render(<EditMediaPage />);
	fireEvent.change(screen.getByLabelText('Choose media files'), {
		target: { files: [new File(['video'], 'replacement.mp4', { type: 'video/mp4' })] },
	});
}

async function editField(label, value) {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
	// Edit state lives in TanStack Query, which re-renders on a later tick.
	await screen.findByDisplayValue(value);
}

describe('EditMediaPage unsaved changes warning', () => {
	beforeEach(() => {
		editMediaQueryClient.clear();
		window.MediaCMS = { editMediaPage: PAGE_CONFIG };
	});

	afterEach(() => {
		delete window.MediaCMS;
		delete window.qq;
		vi.unstubAllGlobals();
	});

	it('warns before leaving only after a field has been edited', async () => {
		render(<EditMediaPage />);

		expect(leaveWarningShown()).toBe(false);

		await editField('More Information and Credits', 'A long description the user has not saved yet.');

		expect(leaveWarningShown()).toBe(true);
	});

	it('stops warning once an edit is undone', async () => {
		render(<EditMediaPage />);
		const documentary = screen.getByRole('checkbox', { name: 'Documentary' });

		fireEvent.click(documentary);
		await waitFor(() => expect(documentary).not.toBeChecked());
		expect(leaveWarningShown()).toBe(true);

		fireEvent.click(documentary);
		await waitFor(() => expect(documentary).toBeChecked());
		expect(leaveWarningShown()).toBe(false);
	});

	it('leaves without a warning after the edits are saved', async () => {
		const navigations = [];
		vi.stubGlobal('location', {
			...window.location,
			assign: vi.fn((url) => navigations.push({ url, warned: leaveWarningShown() })),
		});
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				json: async () => ({ success: true, url: '/view?m=abc123' }),
			}))
		);
		render(<EditMediaPage />);
		await editField('More Information and Credits', 'Updated credits.');

		fireEvent.click(screen.getByRole('button', { name: 'Update Media' }));

		await waitFor(() => expect(navigations).toEqual([{ url: '/view?m=abc123', warned: false }]));
	});

	it('keeps warning before leaving when the server rejects the edits', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 400,
				json: async () => ({ success: false, errors: { title: ['Title is already taken.'] } }),
			}))
		);
		render(<EditMediaPage />);
		await editField('More Information and Credits', 'A long description the user has not saved yet.');

		fireEvent.click(screen.getByRole('button', { name: 'Update Media' }));

		expect(await screen.findByText('title: Title is already taken.')).toBeInTheDocument();
		expect(leaveWarningShown()).toBe(true);
	});

	it('warns before leaving when a replacement video is uploaded but not saved', async () => {
		renderWithReplacementUploader(InstantUploader);

		expect(await screen.findByText('Click Update Media below to save this replacement file.')).toBeInTheDocument();
		expect(leaveWarningShown()).toBe(true);
	});

	// Fine Uploader warns on its own only while bytes are moving, not while paused.
	it('warns before leaving while a replacement video upload is paused', async () => {
		renderWithReplacementUploader(StalledUploader);

		fireEvent.click(await screen.findByRole('button', { name: 'Pause' }));

		expect(await screen.findByText('Paused')).toBeInTheDocument();
		expect(leaveWarningShown()).toBe(true);
	});
});
