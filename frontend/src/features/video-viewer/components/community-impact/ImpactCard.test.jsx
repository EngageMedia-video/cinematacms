import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ImpactCard } from './ImpactCard';

const screenings = [
	{ uid: 'hanoi', title: 'Hanoi Doc Week', year: 2024, url: 'https://example.com/hanoi' },
	{ uid: 'manila', title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
	{ uid: 'dakar', title: '2026 Film Festival, Dakar', date: '2025-02-15' },
];

function renderListCard(props = {}) {
	return render(
		<ImpactCard
			entries={screenings}
			iconName="impactFilmReel"
			label="Screenings"
			layout="list"
			subtitle="This film has been screened 3x"
			variant="screening"
			{...props}
		/>
	);
}

describe('ImpactCard', () => {
	it('previews the latest two entries of a list card with their date and link', () => {
		renderListCard();

		const card = screen.getByRole('article', { name: 'Screenings' });
		expect(within(card).getByText('Screenings')).toBeVisible();
		expect(within(card).getByText('Hanoi Doc Week')).toBeVisible();
		expect(within(card).getByText('2024')).toBeVisible();
		expect(within(card).getByText('Manila Community Film Night')).toBeVisible();
		expect(within(card).getByText('February 2025')).toBeVisible();
		expect(within(card).getByRole('link', { name: 'Open impact link for Hanoi Doc Week' })).toHaveAttribute(
			'href',
			'https://example.com/hanoi'
		);
		expect(within(card).queryByText('2026 Film Festival, Dakar')).not.toBeInTheDocument();
	});

	it('opens the details dialog with every entry from anywhere on the card, without a zoom icon', async () => {
		const user = userEvent.setup();

		renderListCard();

		const opener = screen.getByRole('button', { name: 'Open Screenings details' });
		expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
		expect(opener.querySelector('svg')).toBeNull();

		await user.click(opener);

		const dialog = screen.getByRole('dialog', { name: 'Screenings' });
		expect(within(dialog).getByText('This film has been screened 3x')).toBeVisible();
		expect(within(dialog).getByText('2026 Film Festival, Dakar')).toBeVisible();
	});

	it('keeps entry links working without opening the dialog', async () => {
		const user = userEvent.setup();

		renderListCard();

		const link = screen.getByRole('link', { name: 'Open impact link for Hanoi Doc Week' });
		link.addEventListener('click', (event) => event.preventDefault());
		await user.click(link);

		expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
	});

	it('shows a summary card as a label and a count', async () => {
		const user = userEvent.setup();

		render(
			<ImpactCard
				entries={[{ uid: 'award-1', title: 'Best Documentary', year: 2021 }]}
				iconName="impactTrophy"
				label="Awards"
				layout="summary"
				subtitle="1 recognition"
				value="1 recognition"
				variant="award"
			/>
		);

		const card = screen.getByRole('article', { name: 'Awards' });
		expect(within(card).getByText('1 recognition')).toBeVisible();
		expect(within(card).queryByText('Best Documentary')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: 'Open Awards details' }));

		expect(within(screen.getByRole('dialog', { name: 'Awards' })).getByText('Best Documentary')).toBeVisible();
	});

	it('colours the icon by category', () => {
		render(
			<ImpactCard
				entries={[]}
				iconName="impactTrophy"
				iconShellClassName="bg-bg-emblem-amber text-text-on-emblem-amber"
				label="Awards"
				layout="summary"
				value="0 recognitions"
				variant="award"
			/>
		);

		const icon = screen.getByRole('article', { name: 'Awards' }).querySelector('[data-icon="impactTrophy"]');
		expect(icon.parentElement).toHaveClass('bg-bg-emblem-amber', 'text-text-on-emblem-amber');
	});
});
