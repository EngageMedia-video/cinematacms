import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImpactTimelineItem } from './ImpactTimelineItem';

describe('ImpactTimelineItem', () => {
	it('renders the timeline text, formatted date, and optional link', () => {
		render(
			<ul>
				<ImpactTimelineItem
					accentClassName="text-text-accent"
					date="2025-02-01"
					isFirst
					title="Manila Community Film Night"
					url="https://example.com/manila"
				/>
			</ul>
		);

		expect(screen.getByText('Manila Community Film Night')).toBeVisible();
		expect(screen.getByText('Feb 1, 2025')).toBeVisible();
		const link = screen.getByRole('link', { name: 'Open impact link for Manila Community Film Night' });

		expect(link).toHaveAttribute('href', 'https://example.com/manila');
		expect(link).toHaveClass('text-text-link');
		expect(link).not.toHaveClass('h-size-20', 'w-size-20', 'rounded-full', 'hover:bg-bg-surface-hover');
		expect(link.querySelector('svg')).toHaveAttribute('data-icon', 'impactUrlLogo');
		expect(link.querySelector('svg')).toHaveStyle({ width: '20px', height: '20px' });
	});

	it('omits the link when no url is provided', () => {
		render(
			<ul>
				<ImpactTimelineItem date="2025-02-01" isLast title="Local discussion group" />
			</ul>
		);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});

	it('lets the left rail stretch when item content wraps', () => {
		const { container } = render(
			<ul>
				<ImpactTimelineItem date="2025-02-01" title="A community screening title that is long enough to wrap" />
			</ul>
		);

		const item = container.querySelector('li');
		const rail = item?.querySelector('span[aria-hidden="true"]');
		const connector = rail?.querySelector('.bg-border-default');
		const dot = rail?.querySelector('.bg-bg-timeline-dot');

		expect(item).toHaveClass('min-h-[99px]');
		expect(rail).toHaveClass('min-h-[99px]');
		expect(rail).not.toHaveClass('h-[99px]');
		expect(connector).toHaveClass('top-0', 'bottom-0');
		expect(connector).not.toHaveClass('h-[34px]', 'h-[42px]');
		expect(dot).toHaveClass('top-[29px]', 'translate-y-1/2');
	});
});
