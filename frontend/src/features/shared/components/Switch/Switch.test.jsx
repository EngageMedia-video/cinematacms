import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';

describe('Switch', () => {
	it('renders label on left with checked switch on right', () => {
		render(<Switch defaultChecked>AUTOPLAY</Switch>);

		const input = screen.getByRole('checkbox', { name: 'AUTOPLAY' });
		const label = screen.getByText('AUTOPLAY');
		const track = input.parentElement.querySelector('[data-switch-track]');

		expect(input).toBeChecked();
		expect(label).toBeInTheDocument();
		expect(track).not.toBeNull();
	});

	it('uses semantic track and thumb tokens when checked', () => {
		render(<Switch defaultChecked>AUTOPLAY</Switch>);

		const track = screen
			.getByRole('checkbox', { name: 'AUTOPLAY' })
			.parentElement.querySelector('[data-switch-track]');
		const thumb = screen
			.getByRole('checkbox', { name: 'AUTOPLAY' })
			.parentElement.querySelector('[data-switch-thumb]');

		expect(track).toHaveClass('bg-switch-track-on');
		expect(track).toHaveClass('justify-end');
		expect(thumb).toHaveClass('bg-switch-thumb');
	});

	it('uses the inactive track color when unchecked', () => {
		render(<Switch checked={false}>AUTOPLAY</Switch>);

		const input = screen.getByRole('checkbox', { name: 'AUTOPLAY' });
		const track = input.parentElement.querySelector('[data-switch-track]');

		expect(track).toHaveClass('bg-switch-track-off');
		expect(track).toHaveClass('justify-start');
	});

	it('fires change when toggled', async () => {
		const user = userEvent.setup();
		const handleChange = vi.fn();

		render(
			<Switch checked={false} onChange={handleChange}>
				AUTOPLAY
			</Switch>
		);

		await user.click(screen.getByRole('checkbox', { name: 'AUTOPLAY' }));

		expect(handleChange).toHaveBeenCalledTimes(1);
	});

	it('supports uncontrolled toggling through defaultChecked', async () => {
		const user = userEvent.setup();
		render(<Switch defaultChecked={false}>AUTOPLAY</Switch>);

		const input = screen.getByRole('checkbox', { name: 'AUTOPLAY' });

		expect(input).not.toBeChecked();
		await user.click(input);
		expect(input).toBeChecked();
	});
});
