import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './Dropdown';

const OPTIONS = [
	{ label: 'Feature film', value: 'feature-film' },
	{ label: 'Documentary', value: 'documentary' },
	{ label: 'Short form', value: 'short-form' },
];

const COUNTRY_OPTIONS = [
	{ label: "Côte d'Ivoire", value: 'CI' },
	{ label: 'Iceland', value: 'IS' },
	{ label: 'India', value: 'IN' },
	{ label: 'Indonesia', value: 'ID' },
];

const MULTI_WORD_OPTIONS = [
	{ label: 'Nauru', value: 'NR' },
	{ label: 'Nepal', value: 'NP' },
	{ label: 'New Caledonia', value: 'NC' },
	{ label: 'New Zealand', value: 'NZ' },
	{ label: 'Northern Mariana Islands', value: 'MP' },
];

describe('Dropdown', () => {
	it('renders placeholder, label, helper text, and chevron icon', () => {
		render(
			<Dropdown label="Category" placeholder="Choose category" helperText="Pick one option" options={OPTIONS} />
		);

		const trigger = screen.getByRole('button', { name: 'Choose category' });
		const shell = trigger.parentElement;
		const helperText = screen.getByText('Pick one option');
		const icon = shell.querySelector('svg[data-icon="chevronDown"]');

		expect(helperText).toBeVisible();
		expect(icon).not.toBeNull();
	});

	it('opens menu and selects option in uncontrolled mode', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<Dropdown label="Category" placeholder="Choose category" options={OPTIONS} onChange={onChange} />);

		const trigger = screen.getByRole('button', { name: 'Choose category' });
		await user.click(trigger);
		expect(screen.getByRole('menu')).toBeInTheDocument();
		await user.click(screen.getByRole('menuitemradio', { name: 'Documentary' }));

		expect(onChange).toHaveBeenCalledWith('documentary', OPTIONS[1]);
		expect(screen.getByRole('button', { name: 'Documentary' })).toHaveAttribute('aria-expanded', 'false');
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('uses semantic text colors for menu options', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Category" placeholder="Choose category" options={OPTIONS} />);

		await user.click(screen.getByRole('button', { name: 'Choose category' }));

		expect(screen.getByRole('menuitemradio', { name: 'Documentary' })).toHaveClass('text-text-strong');
	});

	it('keeps long option lists scrollable inside the viewport', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Category" placeholder="Choose category" options={OPTIONS} />);

		await user.click(screen.getByRole('button', { name: 'Choose category' }));

		expect(screen.getByRole('menu')).toHaveClass('overflow-y-auto', 'overscroll-contain');
	});

	it('supports controlled value', () => {
		render(<Dropdown label="Category" value="short-form" options={OPTIONS} />);

		const trigger = screen.getByRole('button', { name: 'Short form' });
		expect(trigger).toBeInTheDocument();
		expect(screen.getByText('Category')).toBeVisible();
	});

	it('closes menu on outside click and escape', () => {
		render(<Dropdown label="Category" placeholder="Choose category" options={OPTIONS} />);

		const trigger = screen.getByRole('button', { name: 'Choose category' });
		fireEvent.click(trigger);
		expect(screen.getByRole('menu')).toBeInTheDocument();

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();

		fireEvent.click(trigger);
		expect(screen.getByRole('menu')).toBeInTheDocument();

		fireEvent.mouseDown(document.body);
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('uses menu semantics and keyboard navigation for options', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Category" placeholder="Choose category" options={OPTIONS} />);

		const trigger = screen.getByRole('button', { name: 'Choose category' });

		trigger.focus();
		await user.keyboard('{ArrowDown}');

		expect(screen.getByRole('menu')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Feature film' })).toHaveFocus());

		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Documentary' })).toHaveFocus());

		await user.keyboard('{End}');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Short form' })).toHaveFocus());
	});

	it('opens the menu and focuses the first match when typing on the closed trigger', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={COUNTRY_OPTIONS} />);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard('i');

		expect(screen.getByRole('menu')).toBeInTheDocument();
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Iceland' })).toHaveFocus());
	});

	it('groups quick keystrokes into a single type-to-jump search', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={COUNTRY_OPTIONS} />);

		const trigger = screen.getByRole('button', { name: 'Choose country' });

		trigger.focus();
		await user.keyboard('{ArrowDown}');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: "Côte d'Ivoire" })).toHaveFocus());

		await user.keyboard('indo');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Indonesia' })).toHaveFocus());
	});

	it('matches accented option labels against unaccented input', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={COUNTRY_OPTIONS} />);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard('cot');

		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: "Côte d'Ivoire" })).toHaveFocus());
	});

	it('starts a new type-to-jump search after a pause', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame'] });

		try {
			render(<Dropdown label="Country" placeholder="Choose country" options={COUNTRY_OPTIONS} />);

			const trigger = screen.getByRole('button', { name: 'Choose country' });
			trigger.focus();
			fireEvent.keyDown(trigger, { key: 'i' });
			await vi.advanceTimersByTimeAsync(50);
			expect(screen.getByRole('menuitemradio', { name: 'Iceland' })).toHaveFocus();

			await vi.advanceTimersByTimeAsync(600);

			fireEvent.keyDown(screen.getByRole('menuitemradio', { name: 'Iceland' }), { key: 'c' });
			await vi.advanceTimersByTimeAsync(50);
			expect(screen.getByRole('menuitemradio', { name: "Côte d'Ivoire" })).toHaveFocus();
		} finally {
			vi.useRealTimers();
		}
	});

	it('treats Space as a search character once the buffer is active', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(
			<Dropdown label="Country" placeholder="Choose country" options={MULTI_WORD_OPTIONS} onChange={onChange} />
		);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard('new z');

		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'New Zealand' })).toHaveFocus());
		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole('menu')).toBeInTheDocument();
	});

	it('keeps native Space behaviour when no search is active', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={MULTI_WORD_OPTIONS} />);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard(' ');

		expect(screen.getByRole('menu')).toBeInTheDocument();
	});

	it('cycles through matches when the same letter is pressed repeatedly', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={MULTI_WORD_OPTIONS} />);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard('n');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Nauru' })).toHaveFocus());

		await user.keyboard('n');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Nepal' })).toHaveFocus());

		await user.keyboard('n');
		await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'New Caledonia' })).toHaveFocus());
	});

	it('ignores printable keys pressed with a modifier', async () => {
		const user = userEvent.setup();

		render(<Dropdown label="Country" placeholder="Choose country" options={COUNTRY_OPTIONS} />);

		screen.getByRole('button', { name: 'Choose country' }).focus();
		await user.keyboard('{Control>}i{/Control}');

		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('uses invalid and disabled semantics', () => {
		const { rerender } = render(<Dropdown label="Category" helperText="Required" invalid options={OPTIONS} />);

		let trigger = screen.getByRole('button', { name: 'Select option' });
		expect(trigger).toHaveAttribute('aria-invalid', 'true');

		rerender(<Dropdown label="Category" helperText="Unavailable" disabled options={OPTIONS} />);

		trigger = screen.getByRole('button', { name: 'Select option' });
		expect(trigger).toBeDisabled();
	});

	it('accepts custom className without breaking rendering', () => {
		render(<Dropdown label="Category" className="px-4" options={OPTIONS} />);

		expect(screen.getByRole('button', { name: 'Select option' })).toBeInTheDocument();
	});
});
