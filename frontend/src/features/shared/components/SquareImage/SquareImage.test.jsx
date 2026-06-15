import { fireEvent, render, screen } from '@testing-library/react';
import { SquareImage } from './SquareImage';

describe('SquareImage', () => {
	it('renders a 60 by 60 image with an 8px radius by default', () => {
		render(<SquareImage alt="Poster" src="https://example.com/poster.jpg" data-testid="square-image" />);

		const wrapper = screen.getByTestId('square-image');
		const image = screen.getByRole('img', { name: 'Poster' });

		expect(wrapper).toHaveStyle({ width: '60px', height: '60px', borderRadius: '8px' });
		expect(image).toHaveAttribute('src', 'https://example.com/poster.jpg');
	});

	it('renders a centered shared icon when no image is available', () => {
		const { container } = render(<SquareImage alt="Placeholder artwork" iconName="example" />);

		expect(screen.getByRole('img', { name: 'Placeholder artwork' })).toBeInTheDocument();
		expect(container.querySelector('svg[data-icon="example"]')).not.toBeNull();
	});

	it('shows dim overlay and spinning loading icon while loading', () => {
		const { container } = render(
			<SquareImage alt="Loading artwork" src="https://example.com/poster.jpg" loading />
		);

		const wrapper = container.firstChild;
		const loadingIcon = container.querySelector('svg[data-icon="loading"]');
		const overlay = container.querySelector('.opacity-80');

		expect(wrapper).toHaveAttribute('aria-busy', 'true');
		expect(loadingIcon).not.toBeNull();
		expect(overlay).not.toBeNull();
	});

	it('passes image props to the inner image even before a source is available', () => {
		render(
			<SquareImage
				alt="Pending thumbnail"
				imageProps={{
					className: 'qq-thumbnail-selector',
					'qq-max-size': '120',
					'qq-server-scale': '',
				}}
			/>
		);

		const image = screen.getByRole('img', { name: 'Pending thumbnail' });

		expect(image).toHaveClass('qq-thumbnail-selector');
		expect(image).toHaveAttribute('qq-max-size', '120');
		expect(image).toHaveAttribute('qq-server-scale', '');
	});

	it('falls back to icon state when image load fails', () => {
		const { container } = render(
			<SquareImage alt="Broken poster" src="https://example.com/broken-poster.jpg" iconName="example" />
		);

		fireEvent.error(screen.getByRole('img', { name: 'Broken poster' }));

		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByRole('img', { name: 'Broken poster' })).toBeInTheDocument();
		expect(container.querySelector('svg[data-icon="example"]')).not.toBeNull();
	});
});
