import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
	it('renders a circular image avatar at the small size by default', () => {
		render(<Avatar name="Tariq Akbar" src="https://example.com/avatar.jpg" data-testid="avatar" />);

		const avatar = screen.getByTestId('avatar');
		const image = screen.getByRole('img', { name: 'Tariq Akbar' });

		expect(avatar).toHaveStyle({ width: 'var(--size-28)', height: 'var(--size-28)' });
		expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
		expect(image).toHaveAttribute('width', '28');
		expect(image).toHaveAttribute('height', '28');
	});

	it('uses first and last initials when no profile image is provided', () => {
		render(<Avatar name="Naufal Fawwaz Andriawan" />);

		const avatar = screen.getByRole('img', { name: 'Naufal Fawwaz Andriawan' });

		expect(avatar).toHaveTextContent('NA');
	});

	it('falls back to initials when the profile image fails to load', () => {
		render(<Avatar name="Mina Sato" src="https://example.com/broken-avatar.jpg" />);

		const image = screen.getByRole('img', { name: 'Mina Sato' });
		fireEvent.error(image);

		expect(screen.getByRole('img', { name: 'Mina Sato' })).toHaveTextContent('MS');
		expect(screen.queryByRole('img', { name: 'Mina Sato' })).toBeInTheDocument();
	});

	it('supports the large size token for larger presentations', () => {
		render(<Avatar name="Layla Hart" size="large" src="https://example.com/avatar.jpg" data-testid="avatar" />);

		const avatar = screen.getByTestId('avatar');
		const image = screen.getByRole('img', { name: 'Layla Hart' });

		expect(avatar).toHaveStyle({ width: 'var(--size-32)', height: 'var(--size-32)' });
		expect(image).toHaveAttribute('width', '32');
		expect(image).toHaveAttribute('height', '32');
	});

	it('renders an optional circular badge icon with the requested overlap offsets', () => {
		render(
			<Avatar
				name="Tariq Akbar"
				src="https://example.com/avatar.jpg"
				size="small"
				badgeType="comment"
				label="Has messages"
			/>
		);

		const badge = screen.getByRole('img', { name: 'Has messages' });
		const badgeIcon = badge.querySelector('[data-badge-icon="commentBlue"]');

		expect(badge).toHaveStyle({ width: 'var(--size-28)', height: 'var(--size-28)' });
		expect(badgeIcon).not.toBeNull();
	});

	it('supports added-favorite and like badge variants with their own icons and fills', () => {
		const { rerender } = render(
			<Avatar
				name="Layla Hart"
				src="https://example.com/avatar.jpg"
				badgeType="added-favorite"
				label="Added favorite"
			/>
		);

		let badge = screen.getByRole('img', { name: 'Added favorite' });
		expect(badge.querySelector('[data-badge-icon="addedFavorite"]')).not.toBeNull();

		rerender(<Avatar name="Mina Sato" src="https://example.com/avatar.jpg" badgeType="like" label="Like" />);

		badge = screen.getByRole('img', { name: 'Like' });
		expect(badge.querySelector('[data-badge-icon="thumbsUpRed"]')).not.toBeNull();
	});

	it('supports a custom badge icon name without requiring a JSX icon object', () => {
		render(
			<Avatar
				name="Layla Hart"
				src="https://example.com/avatar.jpg"
				badgeIcon="addedFavorite"
				label="Added favorite"
			/>
		);

		const badge = screen.getByRole('img', { name: 'Added favorite' });

		expect(badge.querySelector('[data-badge-icon="addedFavorite"]')).not.toBeNull();
	});
});
