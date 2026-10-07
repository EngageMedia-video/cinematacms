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
		licenses: [
			{ id: '1', title: 'CC BY 4.0 - Attribution', allowCommercial: 'yes', allowModifications: 'yes' },
			{
				id: '2',
				title: 'CC BY-NC 4.0 - Attribution-NonCommercial',
				allowCommercial: 'no',
				allowModifications: 'yes',
			},
		],
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

function addPageLink(href, text, attributes = {}) {
	const link = document.createElement('a');
	link.setAttribute('href', href);
	link.textContent = text;
	Object.entries(attributes).forEach(([name, value]) => link.setAttribute(name, value));
	document.body.append(link);
	return link;
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

	it('stops warning when a license choice is replaced by All Rights Reserved again', async () => {
		render(<EditMediaPage />);
		const allRightsReserved = screen.getByRole('checkbox', { name: /All Rights Reserved/ });

		fireEvent.click(screen.getByRole('button', { name: 'Choose License' }));
		fireEvent.click(screen.getByLabelText('Allow commercial uses of your work? No'));
		fireEvent.click(screen.getByRole('button', { name: 'Update License' }));
		await waitFor(() => expect(allRightsReserved).not.toBeChecked());
		expect(leaveWarningShown()).toBe(true);

		fireEvent.click(allRightsReserved);
		await waitFor(() => expect(allRightsReserved).toBeChecked());
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

describe('EditMediaPage leave confirmation', () => {
	let followedLinks;

	// Records the links the browser would follow. jsdom cannot navigate, so every click stops here.
	function recordFollowedLink(event) {
		const link = event.target.closest?.('a[href]');
		if (!link) return;
		if (!event.defaultPrevented) followedLinks.push(link.getAttribute('href'));
		event.preventDefault();
	}

	beforeEach(() => {
		editMediaQueryClient.clear();
		window.MediaCMS = { editMediaPage: PAGE_CONFIG };
		followedLinks = [];
		window.addEventListener('click', recordFollowedLink);
	});

	afterEach(() => {
		window.removeEventListener('click', recordFollowedLink);
		document.querySelectorAll('body > a').forEach((link) => link.remove());
		delete window.MediaCMS;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('asks in a dialog before following an in-app link with unsaved changes', async () => {
		render(<EditMediaPage />);
		const aboutLink = addPageLink('/about', 'About the Site');

		fireEvent.click(aboutLink);
		expect(followedLinks).toEqual(['/about']);
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

		await editField('More Information and Credits', 'A long description the user has not saved yet.');
		fireEvent.click(aboutLink);

		expect(await screen.findByRole('dialog', { name: 'Leave this page?' })).toBeInTheDocument();
		expect(screen.getByText('You have unsaved changes. If you leave now, they will be lost.')).toBeInTheDocument();
		expect(followedLinks).toEqual(['/about']);
	});

	it('follows the link without the browser warning after choosing to leave', async () => {
		const navigations = [];
		vi.stubGlobal('location', {
			...window.location,
			assign: vi.fn((url) => navigations.push({ url, warned: leaveWarningShown() })),
		});
		render(<EditMediaPage />);
		const aboutLink = addPageLink('/about', 'About the Site');
		await editField('More Information and Credits', 'A long description the user has not saved yet.');
		fireEvent.click(aboutLink);

		fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

		expect(navigations).toEqual([{ url: aboutLink.href, warned: false }]);
	});

	it('keeps the edits and the guard after choosing to stay', async () => {
		render(<EditMediaPage />);
		const aboutLink = addPageLink('/about', 'About the Site');
		await editField('More Information and Credits', 'A long description the user has not saved yet.');
		fireEvent.click(aboutLink);

		fireEvent.click(await screen.findByRole('button', { name: 'Stay' }));

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
		expect(screen.getByDisplayValue('A long description the user has not saved yet.')).toBeInTheDocument();
		expect(followedLinks).toEqual([]);
		expect(leaveWarningShown()).toBe(true);
	});

	it('asks before the Cancel button discards unsaved changes', async () => {
		const backNavigations = [];
		vi.spyOn(window.history, 'back').mockImplementation(() =>
			backNavigations.push({ warned: leaveWarningShown() })
		);
		render(<EditMediaPage />);

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(backNavigations).toEqual([{ warned: false }]);

		await editField('More Information and Credits', 'A long description the user has not saved yet.');
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(await screen.findByRole('dialog', { name: 'Leave this page?' })).toBeInTheDocument();
		expect(backNavigations).toHaveLength(1);

		fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
		expect(backNavigations).toEqual([{ warned: false }, { warned: false }]);
	});

	it('lets links that keep this page open through without asking', async () => {
		render(<EditMediaPage />);
		await editField('More Information and Credits', 'A long description the user has not saved yet.');

		fireEvent.click(addPageLink('/about', 'About in a new tab', { target: '_blank' }));
		fireEvent.click(addPageLink('#thumbnail', 'Jump to thumbnail'));
		fireEvent.click(addPageLink('mailto:team@example.org', 'Email the team'));
		fireEvent.click(addPageLink('/media/poster.png', 'Download poster', { download: '' }));
		fireEvent.click(addPageLink('/about', 'About the Site'), { ctrlKey: true });

		expect(followedLinks).toEqual([
			'/about',
			'#thumbnail',
			'mailto:team@example.org',
			'/media/poster.png',
			'/about',
		]);
	});
});
