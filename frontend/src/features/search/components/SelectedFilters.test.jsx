import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectedFilters } from './SelectedFilters';

const FILTERS = [
	{ key: 'country', value: 'Philippines', label: 'Philippines' },
	{ key: 'country', value: 'Indonesia', label: 'Indonesia' },
];

describe('SelectedFilters', () => {
	it('dismisses individual chips', async () => {
		const user = userEvent.setup();
		const onDismiss = vi.fn();

		render(<SelectedFilters filters={FILTERS} onDismiss={onDismiss} />);

		expect(screen.getByLabelText('Selected filters')).toHaveClass('rounded-[8px]', 'bg-bg-panel-selected', 'p-6');
		expect(screen.getByText('Selected')).toHaveClass(
			"font-['Barlow_Semi_Condensed',Arial,sans-serif]",
			'text-[20px]',
			'leading-6',
			'text-text-panel-heading'
		);
		expect(screen.getByText('Philippines').closest('span')).toHaveClass(
			'[--selected-filter-chip-bg:var(--bg-chip-active)]',
			'sm:border',
			'sm:border-border-chip-active',
			'sm:text-text-accent',
			'sm:[--selected-filter-chip-bg:transparent]'
		);

		await user.click(screen.getByRole('button', { name: 'Remove Philippines' }));

		expect(onDismiss).toHaveBeenCalledWith(FILTERS[0]);
	});

	it('uses the solid mobile chip style without the selected-card background', () => {
		render(<SelectedFilters filters={FILTERS} variant="mobile" />);

		expect(screen.getByLabelText('Selected filters')).toHaveClass('flex-wrap', 'gap-[6px]');
		expect(screen.queryByText('Selected')).not.toBeInTheDocument();
		expect(screen.getByText('Philippines').closest('span')).toHaveClass(
			'border-0',
			'px-[6px]',
			'text-text-on-primary',
			'[--selected-filter-chip-bg:var(--bg-chip-active)]'
		);
	});

	it('renders nothing without selected filters', () => {
		const { container } = render(<SelectedFilters filters={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});
