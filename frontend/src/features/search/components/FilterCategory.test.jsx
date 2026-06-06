import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterCategory } from './FilterCategory';

const OPTIONS = [
	{ value: 'Philippines', label: 'Philippines', count: 12 },
	{ value: 'Indonesia', label: 'Indonesia', count: 8 },
];

describe('FilterCategory', () => {
	it('renders collapsed by default and toggles open and closed', async () => {
		const user = userEvent.setup();

		render(<FilterCategory name="country" label="Country of Origin" options={OPTIONS} />);

		expect(screen.queryByLabelText('Philippines')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Country of Origin/i }));

		expect(screen.getByLabelText('Philippines')).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /Country of Origin/i }));

		expect(screen.queryByLabelText('Philippines')).not.toBeInTheDocument();
	});

	it('emits multi-select changes', async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<FilterCategory name="country" label="Country" options={OPTIONS} onChange={onChange} defaultExpanded />);

		await user.click(screen.getByLabelText('Indonesia'));

		expect(onChange).toHaveBeenCalledWith('Indonesia', true);
	});
});
