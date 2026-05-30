import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImpactTimelineItem } from './ImpactTimelineItem';

describe('ImpactTimelineItem', () => {
	it('renders the timeline text, formatted date, and optional link', () => {
		render(
			<ul>
				<ImpactTimelineItem
					accentClassName="text-cinemata-coral-reef-400p"
					date="2025-02-01"
					isFirst
					title="Manila Community Film Night"
					url="https://example.com/manila"
				/>
			</ul>
		);

		expect(screen.getByText('Manila Community Film Night')).toBeVisible();
		expect(screen.getByText('Feb 1, 2025')).toBeVisible();
		expect(screen.getByRole('link', { name: 'Open impact link for Manila Community Film Night' })).toHaveAttribute(
			'href',
			'https://example.com/manila'
		);
	});

	it('omits the link when no url is provided', () => {
		render(
			<ul>
				<ImpactTimelineItem date="2025-02-01" isLast title="Local discussion group" />
			</ul>
		);

		expect(screen.queryByRole('link')).not.toBeInTheDocument();
	});
});
