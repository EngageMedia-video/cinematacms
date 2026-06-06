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

		await user.click(screen.getByRole('button', { name: 'Remove Philippines' }));

		expect(onDismiss).toHaveBeenCalledWith(FILTERS[0]);
	});

	it('renders nothing without selected filters', () => {
		const { container } = render(<SelectedFilters filters={[]} />);

		expect(container).toBeEmptyDOMElement();
	});
});
