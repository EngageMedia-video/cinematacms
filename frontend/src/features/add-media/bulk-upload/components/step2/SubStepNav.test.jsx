import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubStepNav } from './SubStepNav';

describe('SubStepNav', () => {
	it('marks the active sub-step and reports selection changes', async () => {
		const onChange = vi.fn();
		render(<SubStepNav value="basic" onChange={onChange} />);

		expect(screen.getByRole('navigation', { name: 'Detail sections' })).toBeInTheDocument();
		// Basic Details and Other Details carry a required marker, so match by prefix.
		expect(screen.getByRole('button', { name: /Basic Details/ })).toHaveAttribute('aria-current', 'step');

		await userEvent.click(screen.getByRole('button', { name: /Other Details/ }));
		expect(onChange).toHaveBeenCalledWith('other');
	});
});
