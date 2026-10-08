import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AddImpactDialog, normalizeImpactLink } from './AddImpactDialog';

function fieldsPanel() {
	return within(screen.getByTestId('impact-category-fields'));
}

async function chooseCategory(user, name) {
	await user.click(screen.getByRole('radio', { name: new RegExp(`^${name}`) }));
}

async function chooseOption(user, optionName) {
	await user.click(screen.getByRole('button', { name: 'Choose one' }));
	await user.click(screen.getByRole('menuitemradio', { name: optionName }));
}

describe('AddImpactDialog', () => {
	it('opens on the category picker with all five impact kinds', () => {
		render(<AddImpactDialog open />);

		expect(screen.getByRole('dialog', { name: 'Add community impact' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Where has this film made an impact?' })).toBeVisible();
		expect(
			screen.getByText('Tell us where this film has been screened, written about, taught, or recognised.')
		).toBeVisible();

		const group = screen.getByRole('radiogroup', { name: 'What kind of impact?' });
		expect(within(group).getAllByRole('radio')).toHaveLength(5);
		expect(within(group).getByRole('radio', { name: /^Screening/ })).not.toBeChecked();
		expect(within(group).getByRole('radio', { name: /^Article or Review/ })).toBeVisible();
		expect(within(group).getByRole('radio', { name: /^Referenced in Another Work/ })).toBeVisible();
		expect(within(group).getByRole('radio', { name: /^Award/ })).toBeVisible();
		expect(within(group).getByRole('radio', { name: /^Teaching or Research/ })).toBeVisible();
		expect(screen.queryByTestId('impact-category-fields')).not.toBeInTheDocument();
	});

	it('asks for a category before submitting', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole('alert')).toHaveTextContent('Choose what kind of impact this is.');
	});

	it('swaps the form fields when the impact category changes', async () => {
		const user = userEvent.setup();

		render(<AddImpactDialog open />);

		await chooseCategory(user, 'Screening');
		expect(fieldsPanel().getByLabelText('Event or Festival Name')).toBeVisible();
		expect(fieldsPanel().getByLabelText('City')).toBeVisible();
		expect(fieldsPanel().getByText('Keep organiser private')).toBeVisible();

		await chooseCategory(user, 'Award');
		expect(fieldsPanel().getByLabelText('Award Name')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Given by')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Citation (optional)')).toBeVisible();
		expect(fieldsPanel().queryByLabelText('City')).not.toBeInTheDocument();

		await chooseCategory(user, 'Article or Review');
		expect(fieldsPanel().getByLabelText('Written by')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Where was it published? (optional)')).toBeVisible();

		await chooseCategory(user, 'Referenced in Another Work');
		expect(fieldsPanel().getByLabelText('Title of Work')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Made by')).toBeVisible();
		expect(fieldsPanel().getByText('Medium')).toBeVisible();

		await chooseCategory(user, 'Teaching or Research');
		expect(fieldsPanel().getByLabelText('Course or Research Title')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Led by')).toBeVisible();
		expect(fieldsPanel().getByLabelText('Institution (optional)')).toBeVisible();
	});

	it('submits a screening with its place, organiser and privacy choice', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Screening');
		await user.type(screen.getByLabelText('Event or Festival Name'), '  Hanoi Doc Week  ');
		await user.type(screen.getByLabelText('Year'), '2024');
		await user.type(screen.getByLabelText('City'), 'Hanoi');
		await chooseOption(user, 'Viet Nam');
		await user.type(screen.getByLabelText('Who organised it?'), 'Youth Media Collective');
		await user.click(screen.getByRole('checkbox', { name: /Keep organiser private/ }));
		await user.type(screen.getByLabelText('Anything else to share? (optional)'), 'Eighty people stayed.');
		await user.type(screen.getByLabelText('Link (optional)'), 'example.com/hanoi');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith({
			category: 'screening',
			title: 'Hanoi Doc Week',
			year: 2024,
			is_online: false,
			city: 'Hanoi',
			country: 'VN',
			organiser: 'Youth Media Collective',
			organiser_private: true,
			details: 'Eighty people stayed.',
			url: 'https://example.com/hanoi',
		});
	});

	it('drops the place fields for an online screening', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Screening');
		await user.type(screen.getByLabelText('City'), 'Hanoi');
		await user.click(screen.getByRole('checkbox', { name: 'This was an online screening' }));

		expect(screen.queryByLabelText('City')).not.toBeInTheDocument();
		expect(screen.queryByText('Country')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Event or Festival Name'), 'Online watch party');
		await user.type(screen.getByLabelText('Year'), '2025');
		await user.type(screen.getByLabelText('Who organised it?'), 'Cinemata');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		const payload = onSubmit.mock.calls[0][0];
		expect(payload).toMatchObject({ category: 'screening', is_online: true, title: 'Online watch party' });
		expect(payload).not.toHaveProperty('city');
		expect(payload).not.toHaveProperty('country');
	});

	it('submits an award with its result and giver', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Award');
		await user.type(screen.getByLabelText('Award Name'), 'Best Documentary');
		await chooseOption(user, 'Special Mention');
		await user.type(screen.getByLabelText('Given by'), 'Jogja-NETPAC');
		await user.type(screen.getByLabelText('Year'), '2021');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).toHaveBeenCalledWith({
			category: 'award',
			title: 'Best Documentary',
			award_result: 'special_mention',
			organiser: 'Jogja-NETPAC',
			year: 2021,
			details: '',
			url: '',
		});
	});

	it('shows required-field errors for the chosen category instead of submitting', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Referenced in Another Work');
		await user.type(screen.getByLabelText('Title of Work'), 'Tide Lines');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Year')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByLabelText('Made by')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getAllByText('This field is required.')).toHaveLength(3);

		await user.type(screen.getByLabelText('Made by'), 'Pacific Arts Group');

		expect(screen.getByLabelText('Made by')).not.toHaveAttribute('aria-invalid');
	});

	it('rejects a year outside 1900 to this year', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		const nextYear = new Date().getFullYear() + 1;

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Article or Review');
		await user.type(screen.getByLabelText('Title'), 'Films that changed the conversation');
		await user.type(screen.getByLabelText('Written by'), 'Dewi Lestari');
		await user.type(screen.getByLabelText('Year'), String(nextYear));
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText(`Enter a year between 1900 and ${nextYear - 1}.`)).toBeVisible();
	});

	it('rejects javascript: links and surfaces an inline error', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();

		render(<AddImpactDialog onSubmit={onSubmit} open />);

		await chooseCategory(user, 'Teaching or Research');
		await user.type(screen.getByLabelText('Course or Research Title'), 'Media and Climate Justice');
		await user.type(screen.getByLabelText('Year'), '2025');
		await user.type(screen.getByLabelText('Led by'), 'Dr. Maria Santos');
		fireEvent.change(screen.getByLabelText('Link (optional)'), { target: { value: 'javascript:alert(1)' } });
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onSubmit).not.toHaveBeenCalled();
		expect(screen.getByText(/Enter a valid https link/)).toBeVisible();
	});

	it('renders a server error on the field it belongs to and clears it on edit', async () => {
		const user = userEvent.setup();
		const onSubmitErrorClear = vi.fn();
		const { rerender } = render(<AddImpactDialog onSubmitErrorClear={onSubmitErrorClear} open />);

		await chooseCategory(user, 'Award');
		rerender(
			<AddImpactDialog
				onSubmitErrorClear={onSubmitErrorClear}
				open
				submitError={{ field: 'url', message: 'Link is not trustworthy. Please use a secure HTTPS link.' }}
			/>
		);

		expect(screen.getByLabelText('Link (optional)')).toHaveAttribute('aria-invalid', 'true');
		expect(screen.getByText('Link is not trustworthy. Please use a secure HTTPS link.')).toBeVisible();

		await user.type(screen.getByLabelText('Link (optional)'), 'h');

		expect(onSubmitErrorClear).toHaveBeenCalled();
	});

	it('shows a server error without a matching field above the actions', () => {
		render(<AddImpactDialog open submitError={{ field: null, message: 'Unable to submit film impact entry.' }} />);

		expect(screen.getByRole('alert')).toHaveTextContent('Unable to submit film impact entry.');
	});

	it('cancels through onClose and disables submit while submitting', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		const { rerender } = render(<AddImpactDialog onClose={onClose} open />);

		await user.click(screen.getByRole('button', { name: 'CANCEL' }));
		expect(onClose).toHaveBeenCalledTimes(1);

		rerender(<AddImpactDialog onClose={onClose} open submitting />);
		expect(screen.getByRole('button', { name: 'SUBMITTING...' })).toBeDisabled();
	});

	it('closes an open dropdown on Escape without closing the dialog', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn();

		render(<AddImpactDialog onClose={onClose} open />);

		await chooseCategory(user, 'Screening');
		await user.type(screen.getByLabelText('Event or Festival Name'), 'Hanoi Doc Week');
		await user.click(screen.getByRole('button', { name: 'Choose one' }));
		expect(screen.getByRole('menu')).toBeVisible();

		await user.keyboard('{Escape}');

		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Event or Festival Name')).toHaveValue('Hanoi Doc Week');

		await user.keyboard('{Escape}');

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not carry a private organiser into another category', async () => {
		const user = userEvent.setup();

		render(<AddImpactDialog open />);

		await chooseCategory(user, 'Screening');
		await user.type(screen.getByLabelText('Who organised it?'), 'Underground Film Club');
		await user.click(screen.getByRole('checkbox', { name: /Keep organiser private/ }));
		await chooseCategory(user, 'Award');

		expect(screen.getByLabelText('Given by')).toHaveValue('');
	});

	it('keeps a public organiser when the category changes', async () => {
		const user = userEvent.setup();

		render(<AddImpactDialog open />);

		await chooseCategory(user, 'Screening');
		await user.type(screen.getByLabelText('Who organised it?'), 'Busan IFF');
		await chooseCategory(user, 'Award');

		expect(screen.getByLabelText('Given by')).toHaveValue('Busan IFF');
	});

	it('limits the city to the length the server stores', async () => {
		const user = userEvent.setup();

		render(<AddImpactDialog open />);

		await chooseCategory(user, 'Screening');

		expect(screen.getByLabelText('City')).toHaveAttribute('maxlength', '100');
		expect(screen.getByLabelText('Who organised it?')).toHaveAttribute('maxlength', '200');
	});

	it('starts blank again after it is closed and reopened', async () => {
		const user = userEvent.setup();
		const { rerender } = render(<AddImpactDialog open />);

		await chooseCategory(user, 'Award');
		await user.type(screen.getByLabelText('Award Name'), 'Best Documentary');

		rerender(<AddImpactDialog open={false} />);
		rerender(<AddImpactDialog open />);

		expect(screen.getByRole('radio', { name: /^Award/ })).not.toBeChecked();
		expect(screen.queryByTestId('impact-category-fields')).not.toBeInTheDocument();
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
