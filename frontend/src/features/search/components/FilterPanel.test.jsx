import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from './FilterPanel';

const SECTIONS = [
	{
		key: 'country',
		label: 'Country of Origin',
		options: [{ value: 'Philippines', label: 'Philippines' }],
		selectMode: 'multi',
		selectedValues: [],
	},
];

describe('FilterPanel', () => {
	it('emits reset and section changes', async () => {
		const user = userEvent.setup();
		const onReset = vi.fn();
		const onSectionChange = vi.fn();

		render(
			<FilterPanel
				sections={SECTIONS.map((section) => ({ ...section, defaultExpanded: true }))}
				onReset={onReset}
				onSectionChange={onSectionChange}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'Reset Filters' }));
		await user.click(screen.getByLabelText('Philippines'));

		expect(onReset).toHaveBeenCalledTimes(1);
		expect(onSectionChange).toHaveBeenCalledWith('country', 'Philippines', true);
	});
});
