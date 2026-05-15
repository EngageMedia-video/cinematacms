import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
	it('renders a borderless article with light defaults and dark mode overrides', () => {
		render(<Card>Featured film metadata</Card>);

		const card = screen.getByRole('article');
		expect(card).toHaveClass('bg-bg-cards');
		expect(card).toHaveClass('dark:bg-cinemata-pacific-deep-900');
		expect(card).not.toHaveClass('border');
		expect(card).not.toHaveClass('border-cinemata-pacific-deep-100');
	});

	it('supports alternate semantic elements and custom classes', () => {
		render(
			<Card as="section" aria-label="Featured details" className="p-6">
				Featured film metadata
			</Card>
		);

		const card = screen.getByRole('region', { name: 'Featured details' });
		expect(card).toHaveClass('p-6');
		expect(card).toHaveTextContent('Featured film metadata');
	});

	it('supports a muted light and dark variant', () => {
		render(<Card variant="muted">Muted card</Card>);

		const card = screen.getByRole('article');
		expect(card).toHaveClass('bg-cinemata-neutral-200');
		expect(card).toHaveClass('dark:bg-cinemata-pacific-deep-800');
	});

	it('supports an outlined variant when a bordered card is needed', () => {
		render(<Card variant="outlined">Outlined card</Card>);

		const card = screen.getByRole('article');
		expect(card).toHaveClass('border');
		expect(card).toHaveClass('border-cinemata-pacific-deep-100');
		expect(card).toHaveClass('dark:border-cinemata-pacific-deep-700');
	});

	it('falls back to the default variant for unsupported variants', () => {
		render(<Card variant="unsupported">Fallback card</Card>);

		expect(screen.getByRole('article')).toHaveClass('bg-bg-cards');
	});
});
