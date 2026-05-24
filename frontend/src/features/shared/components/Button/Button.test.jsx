import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

function TestIcon() {
	return (
		<svg data-testid="left-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path d="M10 3V17M3 10H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

describe('Button', () => {
	it('renders with the default button type', () => {
		render(<Button>Browse films</Button>);

		const button = screen.getByRole('button', { name: 'Browse films' });

		expect(button).toHaveAttribute('type', 'button');
		expect(button.className).toContain('bg-brand-primary');
		expect(button.className).toContain('text-btn-text');
	});

	it('renders optional left icon at design-system size', () => {
		render(<Button icon={<TestIcon />}>Continue</Button>);

		const icon = screen.getByTestId('left-icon');
		const iconWrapper = icon.parentElement;

		expect(iconWrapper).toHaveStyle({ width: 'var(--size-20)', height: 'var(--size-20)' });
	});

	it('renders supported variants without breaking semantics', () => {
		const { rerender } = render(<Button variant="secondary">Learn more</Button>);

		expect(screen.getByRole('button', { name: 'Learn more' })).toBeInTheDocument();

		rerender(<Button variant="tertiary">Donate</Button>);
		expect(screen.getByRole('button', { name: 'Donate' })).toBeInTheDocument();

		rerender(<Button variant="primary-outline">Outline</Button>);
		expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();

		rerender(<Button variant="secondary-outline">Outline secondary</Button>);
		expect(screen.getByRole('button', { name: 'Outline secondary' })).toBeInTheDocument();

		rerender(<Button variant="special">See all</Button>);
		expect(screen.getByRole('button', { name: 'See all' })).toBeInTheDocument();

		rerender(<Button variant="text">Read more</Button>);
		expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
	});

	it('supports base and small size classes', () => {
		const { rerender } = render(<Button>Base size</Button>);

		expect(screen.getByRole('button', { name: 'Base size' })).toHaveClass('px-space-base', 'py-size-10');

		rerender(<Button size="sm">Small size</Button>);
		expect(screen.getByRole('button', { name: 'Small size' })).toHaveClass(
			'px-size-12',
			'py-size-8',
			'rounded-ds-8'
		);
	});

	it('renders icon-only variant without visible label text', () => {
		render(<Button variant="icon" icon={<TestIcon />} aria-label="More actions" />);

		const button = screen.getByRole('button', { name: 'More actions' });

		expect(screen.queryByText('More actions')).not.toBeInTheDocument();
		expect(button.querySelectorAll('span')).toHaveLength(1);
	});

	it('centers a primary button icon when the label is empty', () => {
		render(<Button variant="primary" icon={<TestIcon />} aria-label="Create item" />);

		const button = screen.getByRole('button', { name: 'Create item' });

		expect(button).toHaveClass('justify-center', 'gap-0', 'p-size-10', 'rounded-ds-4');
		expect(button.querySelectorAll('span')).toHaveLength(1);
	});

	it('centers a secondary button icon when the label is empty', () => {
		render(<Button variant="secondary" icon={<TestIcon />} aria-label="Learn more" size="sm" />);

		const button = screen.getByRole('button', { name: 'Learn more' });

		expect(button).toHaveClass('justify-center', 'gap-0', 'p-size-8', 'rounded-ds-8');
		expect(button.querySelectorAll('span')).toHaveLength(1);
	});

	it('treats hidden label content as icon-only for layout', () => {
		render(
			<Button variant="primary" icon={<TestIcon />} aria-label="Share" size="sm">
				<span className="hidden">Share</span>
			</Button>
		);

		const button = screen.getByRole('button', { name: 'Share' });

		expect(button).toHaveClass('justify-center', 'gap-0', 'p-size-8', 'rounded-ds-8');
		expect(button.querySelectorAll('span')).toHaveLength(1);
	});

	it('allows overriding text color via className', () => {
		render(
			<Button variant="text" className="text-cinemata-red-500">
				Delete item
			</Button>
		);

		expect(screen.getByRole('button', { name: 'Delete item' })).toBeInTheDocument();
	});

	it('renders special variant icon on the right', () => {
		render(
			<Button variant="special" icon={<TestIcon />}>
				See all
			</Button>
		);

		const button = screen.getByRole('button', { name: 'See all' });
		const label = screen.getByText('See all');
		const icon = screen.getByTestId('left-icon');

		expect(label.nextElementSibling).toBe(icon.parentElement);
		expect(button.firstElementChild).toBe(label);
	});

	it('supports explicit icon positioning for icon-and-text buttons', () => {
		render(
			<Button variant="primary" icon={<TestIcon />} iconPosition="right">
				Pause
			</Button>
		);

		const button = screen.getByRole('button', { name: 'Pause' });
		const label = screen.getByText('Pause');
		const icon = screen.getByTestId('left-icon');

		expect(label.nextElementSibling).toBe(icon.parentElement);
		expect(button.firstElementChild).toBe(label);
	});

	it('falls back to primary variant for unsupported variants', () => {
		render(<Button variant="unsupported">Fallback</Button>);

		expect(screen.getByRole('button', { name: 'Fallback' })).toBeInTheDocument();
	});

	it('allows overriding background color via className', () => {
		render(
			<Button variant="primary" className="bg-cinemata-red-500">
				Custom BG
			</Button>
		);

		expect(screen.getByRole('button', { name: 'Custom BG' })).toBeInTheDocument();
	});

	it('renders long labels without creating icon wrapper when icon is absent', () => {
		render(
			<Button>
				International documentary showcase with a much longer call to action than the default example
			</Button>
		);

		expect(
			screen.getByRole('button', {
				name: 'International documentary showcase with a much longer call to action than the default example',
			})
		).toBeInTheDocument();
		expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
	});

	it('forwards native disabled and click behavior', async () => {
		const user = userEvent.setup();
		const onClick = vi.fn();

		render(
			<Button disabled onClick={onClick}>
				Processing
			</Button>
		);

		const button = screen.getByRole('button', { name: 'Processing' });

		expect(button).toBeDisabled();
		await user.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});
});
