import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddImpactDialog, normalizeImpactLink } from './AddImpactDialog';

describe('AddImpactDialog', () => {
	it('keeps the date input native while hiding the browser picker indicator', () => {
		const { baseElement } = render(<AddImpactDialog open />);

		expect(baseElement.querySelector('.impact-date-field input[type="date"]')).not.toBeNull();
	});

	it('submits trimmed form values with the selected category', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onClose={onClose} onSubmit={onSubmit} open />);

		await user.type(screen.getByLabelText('Where did this impact happen?'), '  Jakarta community hall  ');
		await user.type(screen.getByLabelText('Add more details'), 'Screened with a youth media collective.');
		await user.type(screen.getByLabelText('Date of impact'), '2026-05-29');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'https://example.com/impact');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith({
			category: 'screening',
			details: 'Screened with a youth media collective.',
			event_date: '2026-05-29',
			link: 'https://example.com/impact',
			location: 'Jakarta community hall',
			title: 'Jakarta community hall',
			url: 'https://example.com/impact',
		});
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('disables submit when details exceed the word limit', async () => {
		const user = userEvent.setup();
		const tooManyWords = Array.from({ length: 81 }, (_, index) => `word${index}`).join(' ');

		render(<AddImpactDialog open />);

		await user.type(screen.getByLabelText('Where did this impact happen?'), 'Jakarta');
		await user.type(screen.getByLabelText('Date of impact'), '2026-05-29');
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

		await user.type(screen.getByLabelText('Where did this impact happen?'), 'Jakarta');
		await user.type(screen.getByLabelText('Date of impact'), '2026-05-29');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'javascript:alert(1)');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText(/Enter a valid http\(s\) link/)).toBeVisible();
	});

	it('normalizes bare hostnames to https:// before submitting', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await user.type(screen.getByLabelText('Where did this impact happen?'), 'Jakarta');
		await user.type(screen.getByLabelText('Date of impact'), '2026-05-29');
		await user.click(screen.getByRole('button', { name: 'Select community impact category' }));
		await user.click(screen.getByRole('menuitemradio', { name: 'Screened In' }));
		await user.type(screen.getByLabelText('Add a link'), 'example.com/path');
		await user.click(screen.getByRole('button', { name: 'SUBMIT COMMUNITY IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ link: 'https://example.com/path', url: 'https://example.com/path' })
		);
	});
});

describe('normalizeImpactLink', () => {
	it('returns empty string for empty input', () => {
		expect(normalizeImpactLink('')).toBe('');
		expect(normalizeImpactLink('   ')).toBe('');
	});

	it('accepts http(s) links unchanged (normalized form)', () => {
		expect(normalizeImpactLink('https://example.com')).toBe('https://example.com/');
		expect(normalizeImpactLink('http://example.com/path')).toBe('http://example.com/path');
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
