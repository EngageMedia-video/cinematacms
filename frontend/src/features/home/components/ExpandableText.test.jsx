import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ExpandableText } from './ExpandableText';

describe('ExpandableText', () => {
	it('renders null when text is empty', () => {
		const { container } = render(<ExpandableText text="" />);
		expect(container.firstChild).toBeNull();
	});

	it('renders the text content as plain text', () => {
		render(<ExpandableText text="Hello world" />);
		expect(screen.getByText('Hello world')).toBeInTheDocument();
	});

	it('does not render an img element when text contains an img tag', () => {
		render(<ExpandableText text="<img src=x onerror=alert(1)>" />);
		expect(screen.queryByRole('img')).toBeNull();
		expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
	});

	it('shows READ MORE button in collapsed state', () => {
		render(<ExpandableText text="Some long text" />);
		const btn = screen.getByRole('button', { name: 'READ MORE' });
		expect(btn).toBeInTheDocument();
		expect(btn).toHaveAttribute('aria-expanded', 'false');
	});

	it('applies clamp class when collapsed', () => {
		render(<ExpandableText text="Some long text" clampLines={2} />);
		const para = screen.getByText('Some long text');
		expect(para).toHaveClass('line-clamp-2');
	});

	it('removes clamp class when expanded', async () => {
		const user = userEvent.setup();
		render(<ExpandableText text="Some long text" clampLines={2} />);
		const btn = screen.getByRole('button', { name: 'READ MORE' });

		await user.click(btn);

		const para = screen.getByText('Some long text');
		expect(para).not.toHaveClass('line-clamp-2');
		expect(screen.getByRole('button', { name: 'READ LESS' })).toHaveAttribute('aria-expanded', 'true');
	});

	it('collapses again when READ LESS is clicked', async () => {
		const user = userEvent.setup();
		render(<ExpandableText text="Some long text" clampLines={2} />);

		await user.click(screen.getByRole('button', { name: 'READ MORE' }));
		await user.click(screen.getByRole('button', { name: 'READ LESS' }));

		expect(screen.getByText('Some long text')).toHaveClass('line-clamp-2');
		expect(screen.getByRole('button', { name: 'READ MORE' })).toHaveAttribute('aria-expanded', 'false');
	});
});
