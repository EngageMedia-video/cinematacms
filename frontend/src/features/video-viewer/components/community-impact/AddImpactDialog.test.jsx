import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddImpactDialog, normalizeImpactLink } from './AddImpactDialog';

describe('AddImpactDialog', () => {
	it('renders the Figma content labels in the modal form', () => {
		render(<AddImpactDialog open />);

		expect(screen.getByText('Where has this film made an impact?')).toBeVisible();
		expect(screen.getByLabelText('Where did you see this film')).toBeVisible();
		expect(screen.getByLabelText('Add more details')).toBeVisible();
		expect(screen.getByText('Maximum 80 Words')).toBeVisible();
	});

	it('submits trimmed form values with the selected category', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onClose={onClose} onSubmit={onSubmit} open />);

		await user.type(screen.getByLabelText('Where did you see this film'), '  Jakarta community hall  ');
		await user.type(screen.getByLabelText('Add more details'), 'Screened with a youth media collective.');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'https://drive.google.com/file/d/impact/view');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith({
			category: 'screening',
			details: 'Screened with a youth media collective.',
			link: 'https://drive.google.com/file/d/impact/view',
			location: 'Jakarta community hall',
			title: 'Jakarta community hall',
			url: 'https://drive.google.com/file/d/impact/view',
		});
		expect(onClose).not.toHaveBeenCalled();
	});

	it('disables submit when details exceed the word limit', async () => {
		const user = userEvent.setup();
		const tooManyWords = Array.from({ length: 81 }, (_, index) => `word${index}`).join(' ');

		render(<AddImpactDialog open />);

		await user.type(screen.getByLabelText('Where did you see this film'), 'Jakarta');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add more details'), tooManyWords);

		expect(screen.getByText('Maximum 80 Words • 81/80')).toBeVisible();
		expect(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' })).toBeDisabled();
	});

	it('calls onClose from the close button', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<AddImpactDialog onClose={onClose} open />);

		await user.click(screen.getByRole('button', { name: 'Close add impact dialog' }));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('rejects javascript: links and surfaces an inline error', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const onClose = vi.fn();

		render(<AddImpactDialog onClose={onClose} onSubmit={onSubmit} open />);

		await user.type(screen.getByLabelText('Where did you see this film'), 'Jakarta');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'javascript:alert(1)');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText(/Enter a valid https link/)).toBeVisible();
	});

	it('normalizes bare hostnames to https:// before submitting', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await user.type(screen.getByLabelText('Where did you see this film'), 'Jakarta');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'example.com/path');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ link: 'https://example.com/path', url: 'https://example.com/path' })
		);
	});

	it('keeps the dialog open and renders server URL validation errors', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onSubmitErrorClear = vi.fn();

		render(
			<AddImpactDialog
				onClose={onClose}
				onSubmitErrorClear={onSubmitErrorClear}
				open
				submitError={{
					field: 'url',
					message: 'Link is not trustworthy. Please use a known sharing service.',
				}}
			/>
		);

		expect(screen.getByRole('dialog', { name: 'Add community impact' })).toBeVisible();
		expect(screen.getByText('Link is not trustworthy. Please use a known sharing service.')).toBeVisible();

		await user.type(screen.getByLabelText('Add a link'), 'https://drive.google.com/file/d/abc/view');

		expect(onSubmitErrorClear).toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('only offers manually writable categories', async () => {
		const user = userEvent.setup();

		render(
			<AddImpactDialog
				open
				categories={[
					{ value: 'screening', label: 'Screened In' },
					{ value: 'featured', label: 'Featured In' },
					{ value: 'saves', label: 'Saves & Playlists' },
					{ value: 'playlists', label: 'Playlists' },
					{ value: 'academic', label: 'Academic Usage' },
					{ value: 'curated', label: 'Curated Into' },
				]}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));

		expect(screen.getByRole('menuitemradio', { name: 'Screened In' })).toBeVisible();
		expect(screen.getByRole('menuitemradio', { name: 'Featured In' })).toBeVisible();
		expect(screen.getByRole('menuitemradio', { name: 'Academic Usage' })).toBeVisible();
		expect(screen.queryByRole('menuitemradio', { name: 'Saves & Playlists' })).not.toBeInTheDocument();
		expect(screen.queryByRole('menuitemradio', { name: 'Playlists' })).not.toBeInTheDocument();
		expect(screen.queryByRole('menuitemradio', { name: 'Curated Into' })).not.toBeInTheDocument();
	});
});

describe('normalizeImpactLink', () => {
	it('returns empty string for empty input', () => {
		expect(normalizeImpactLink('')).toBe('');
		expect(normalizeImpactLink('   ')).toBe('');
	});

	it('accepts https links unchanged (normalized form)', () => {
		expect(normalizeImpactLink('https://example.com')).toBe('https://example.com/');
	});

	it('rejects http links', () => {
		expect(normalizeImpactLink('http://example.com/path')).toBeNull();
	});

	it('rejects unsafe schemes', () => {
		expect(normalizeImpactLink('javascript:alert(1)')).toBeNull();
		expect(normalizeImpactLink('data:text/html,<script>alert(1)</script>')).toBeNull();
		expect(normalizeImpactLink('file:///etc/passwd')).toBeNull();
	});

	it('prepends https:// when no scheme is supplied', () => {
		expect(normalizeImpactLink('example.com')).toBe('https://example.com/');
		expect(normalizeImpactLink('  example.com/path  ')).toBe('https://example.com/path');
	});
});
