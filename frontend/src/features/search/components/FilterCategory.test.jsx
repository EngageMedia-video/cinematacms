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
		expect(screen.getByRole('button', { name: /Country of Origin/i }).closest('section')).toHaveClass(
			'border-border-disclosure-trigger',
			'bg-bg-disclosure-trigger'
		);

		await user.click(screen.getByRole('button', { name: /Country of Origin/i }));

		expect(screen.getByLabelText('Philippines')).toBeInTheDocument();
		expect(document.getElementById('country-options')).toHaveClass(
			'max-h-[186px]',
			'overflow-y-auto',
			'border-border-disclosure-content',
			'bg-bg-disclosure-content'
		);
		expect(screen.getByText('Philippines').closest('label').querySelector('[aria-hidden="true"]')).toHaveClass(
			'bg-bg-control-unchecked',
			'peer-checked:bg-bg-control-checked',
			'peer-checked:text-text-control-checked'
		);

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
