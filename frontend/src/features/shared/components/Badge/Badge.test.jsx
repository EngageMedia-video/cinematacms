import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
	it('renders the caption treatment with the provided color', () => {
		render(<Badge color="#0c5273">Premiere</Badge>);

		const badge = screen.getByText('Premiere');

		expect(badge).toHaveTextContent('Premiere');
		expect(badge).toHaveStyle({ backgroundColor: 'rgb(12, 82, 115)' });
	});

	it('supports style overrides', () => {
		render(
			<Badge color="#111111" style={{ letterSpacing: '0.12em' }}>
				Now Showing
			</Badge>
		);

		const badge = screen.getByText('Now Showing');

		expect(badge).toHaveTextContent('Now Showing');
		expect(badge).toHaveStyle({ letterSpacing: '0.12em' });
	});

	it('resolves design token names into CSS variables', () => {
		render(<Badge color="pacific-deep-950">Featured</Badge>);

		const badge = screen.getByText('Featured');

		expect(badge.style.backgroundColor).toBe('var(--cinemata-pacific-deep-950)');
	});
});
