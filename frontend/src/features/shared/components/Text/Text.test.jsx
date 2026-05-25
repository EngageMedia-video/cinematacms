import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('Text', () => {
	describe('body variants', () => {
		it('renders a paragraph by default', () => {
			render(<Text>Hello</Text>);
			expect(screen.getByText('Hello').tagName).toBe('P');
		});

		it('applies default body-14 typography variant', () => {
			render(<Text>Hello</Text>);
			expect(screen.getByText('Hello')).toHaveClass('body-body-14-regular');
		});

		it('applies the body color by default', () => {
			render(<Text>Hello</Text>);
			const el = screen.getByText('Hello');
			expect(el).toHaveClass('text-text-primary');
		});

		it('applies the meta color when color="meta"', () => {
			render(<Text color="meta">Meta</Text>);
			const el = screen.getByText('Meta');
			expect(el).toHaveClass('text-text-muted');
			expect(el).not.toHaveClass('text-text-primary');
		});

		it('applies the description color when color="description"', () => {
			render(<Text color="description">Description</Text>);
			const el = screen.getByText('Description');
			expect(el).toHaveClass('text-text-description');
			expect(el).not.toHaveClass('text-text-primary');
		});

		it('applies the sunset horizon color when color="sunset-horizon"', () => {
			render(<Text color="sunset-horizon">Author</Text>);
			const el = screen.getByText('Author');
			expect(el).toHaveClass('text-text-link');
			expect(el).not.toHaveClass('text-text-primary');
		});

		it('applies no color when color is unrecognised', () => {
			render(<Text color="unknown">No color</Text>);
			const el = screen.getByText('No color');
			expect(el).not.toHaveClass('text-text-primary');
			expect(el).not.toHaveClass('text-text-muted');
		});

		it('applies the selected body variant', () => {
			render(<Text variant="body-12">Small</Text>);
			expect(screen.getByText('Small')).toHaveClass('body-body-12-regular');
		});

		it.each([
			['body-18', 'body-body-18-regular'],
			['body-18-medium', 'body-body-18-medium'],
			['body-18-bold', 'body-body-18-bold'],
			['body-16-bold', 'body-body-16-bold'],
			['caption-10-semibold', 'caption-caption-10-semibold'],
		])('exposes variant="%s" as %s', (variant, cssClass) => {
			render(<Text variant={variant}>Sample</Text>);
			expect(screen.getByText('Sample')).toHaveClass(cssClass);
		});

		it('renders as a span when as="span"', () => {
			render(<Text as="span">Inline</Text>);
			expect(screen.getByText('Inline').tagName).toBe('SPAN');
		});
	});

	describe('heading variants', () => {
		it.each([
			['h1', 'H1', 'heading-h1-56-medium'],
			['h2', 'H2', 'heading-h2-48-medium'],
			['h3', 'H3', 'heading-h3-40-medium'],
			['h4', 'H4', 'heading-h4-32-medium'],
			['h5', 'H5', 'heading-h5-24-medium'],
			['h6', 'H6', 'heading-h6-20-medium'],
		])('variant="%s" renders <%s> with %s', (variant, tag, cssClass) => {
			render(<Text variant={variant}>Title</Text>);
			const el = screen.getByText('Title');
			expect(el.tagName).toBe(tag);
			expect(el).toHaveClass(cssClass);
		});

		it('applies the bold weight variant', () => {
			render(<Text variant="h4-bold">Bold heading</Text>);
			expect(screen.getByText('Bold heading')).toHaveClass('heading-h4-32-bold');
		});

		it('applies the regular weight variant', () => {
			render(<Text variant="h5-regular">Regular heading</Text>);
			expect(screen.getByText('Regular heading')).toHaveClass('heading-h5-24-regular');
		});

		it('does not apply the body color to heading variants', () => {
			render(<Text variant="h6">No default color</Text>);
			const el = screen.getByText('No default color');
			expect(el).not.toHaveClass('text-text-primary');
		});

		it('overrides the default element with as prop', () => {
			render(
				<Text variant="h6" as="h2">
					Semantic override
				</Text>
			);
			expect(screen.getByText('Semantic override').tagName).toBe('H2');
		});
	});

	describe('shared behaviour', () => {
		it('merges extra className', () => {
			render(<Text className="m-0">Content</Text>);
			expect(screen.getByText('Content')).toHaveClass('m-0');
		});

		it('passes through extra props', () => {
			render(<Text data-testid="txt">Content</Text>);
			expect(screen.getByTestId('txt')).toBeInTheDocument();
		});

		it('applies the text button action treatment', () => {
			render(
				<Text as="button" action="text-button">
					Read more
				</Text>
			);
			const button = screen.getByRole('button', { name: 'Read more' });
			expect(button).toHaveClass('appearance-none');
			expect(button).toHaveClass('border-0');
			expect(button).toHaveClass('bg-transparent');
			expect(button).toHaveClass('p-0');
			expect(button).toHaveClass('hover:underline');
		});

		it('applies the text link action treatment', () => {
			render(
				<Text as="a" action="text-link" href="/films">
					View all
				</Text>
			);
			const link = screen.getByRole('link', { name: 'View all' });
			expect(link).toHaveClass('no-underline');
			expect(link).toHaveClass('focus-visible:ring-2');
		});
	});
});
