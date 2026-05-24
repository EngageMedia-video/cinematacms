import { render, screen } from '@testing-library/react';
import { GetNotifiedButton } from './GetNotifiedButton';

describe('GetNotifiedButton', () => {
	it('renders default bell state', () => {
		render(<GetNotifiedButton />);

		const button = screen.getByRole('button', { name: 'Get Notified' });

		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
		expect(screen.getByText('GET NOTIFIED')).toBeInTheDocument();
		expect(button.className).toContain('bg-brand-primary');
	});

	it('renders active bell plus right check state', () => {
		render(<GetNotifiedButton notified />);

		const button = screen.getByRole('button', { name: 'Get Notified' });

		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(screen.getByTestId('bell-icon')).toBeInTheDocument();
		expect(screen.getByTestId('check-icon')).toBeInTheDocument();
		expect(screen.queryByText('GET NOTIFIED')).not.toBeInTheDocument();
		expect(button.className).toContain('bg-brand-primary');
	});

	it('has hover class when inactive', () => {
		render(<GetNotifiedButton />);

		const button = screen.getByRole('button', { name: 'Get Notified' });

		expect(button.className).toContain('hover:bg-brand-primary-hover');
	});

	it('shakes when switching from inactive to active', () => {
		const animate = vi.fn();
		const { rerender } = render(<GetNotifiedButton />);

		const bellWrapper = screen.getByTestId('bell-icon').parentElement;
		const originalAnimate = bellWrapper.animate;
		bellWrapper.animate = animate;

		try {
			rerender(<GetNotifiedButton notified />);
			expect(animate).toHaveBeenCalledOnce();
		} finally {
			bellWrapper.animate = originalAnimate;
		}
	});
});
