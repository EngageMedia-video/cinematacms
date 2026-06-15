import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubStepNav } from './SubStepNav';

describe('SubStepNav', () => {
	it('marks the active sub-step and reports selection changes', async () => {
		const onChange = vi.fn();
		render(<SubStepNav value="basic" onChange={onChange} />);

		expect(screen.getByRole('tab', { name: 'Basic Details' })).toHaveAttribute('aria-selected', 'true');

		await userEvent.click(screen.getByRole('tab', { name: 'Other Details' }));
		expect(onChange).toHaveBeenCalledWith('other');
	});
});
