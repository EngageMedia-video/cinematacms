import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubStepNav } from './SubStepNav';
import { BulkUploadConfigProvider } from '../../bulkUploadConfig';

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

	it('hides the Admin Settings tab for non-admins', () => {
		render(<SubStepNav value="basic" onChange={vi.fn()} />);
		expect(screen.queryByRole('button', { name: /Admin Settings/ })).not.toBeInTheDocument();
	});

	it('shows the Admin Settings tab as the last tab when admin', () => {
		render(
			<BulkUploadConfigProvider value={{ canUseAdminSettings: true }}>
				<SubStepNav value="basic" onChange={vi.fn()} />
			</BulkUploadConfigProvider>
		);
		const tabs = screen.getAllByRole('button');
		expect(tabs[tabs.length - 1]).toHaveTextContent('Admin Settings');
	});
});
