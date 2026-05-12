import { render, screen } from '@testing-library/react';
import { FollowButton } from './FollowButton';

describe('FollowButton', () => {
	it('renders unfollowed label with person name and follow icon', () => {
		render(<FollowButton personName="Alexandra" />);

		const button = screen.getByRole('button', { name: 'Follow Alexandra' });

		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByTestId('follow-icon')).toBeInTheDocument();
		expect(button.className).toContain('bg-cinemata-sunset-horizon-500');
		expect(button.className).toContain('text-cinemata-white');
	});

	it('switches to followed treatment', () => {
		render(<FollowButton personName="Alexandra" followed />);

		const button = screen.getByRole('button', { name: 'Following' });

		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(button.className).toContain('border-cinemata-sunset-horizon-500');
		expect(button.className).toContain('text-cinemata-sunset-horizon-500');
		expect(button.className).toContain('bg-transparent');
	});

	it('has hover class when unfollowed', () => {
		render(<FollowButton personName="Alexandra" />);

		const button = screen.getByRole('button', { name: 'Follow Alexandra' });

		expect(button.className).toContain('hover:bg-cinemata-sunset-horizon-700');
	});
});
