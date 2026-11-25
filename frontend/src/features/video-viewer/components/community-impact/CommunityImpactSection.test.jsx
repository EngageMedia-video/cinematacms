import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CommunityImpactSection } from './CommunityImpactSection';

const contributorEntry = {
	viewer_sees_status: true,
	viewer_can_delete: true,
	viewer_can_edit: false,
	viewer_review_url: '',
};

function screening(uid, title, year) {
	return { uid, category: 'screening', title, organiser: `${title} Club`, year, author_name: 'Another Member' };
}

const entries = {
	award: [
		{
			...contributorEntry,
			uid: 'w1',
			category: 'award',
			title: 'Best Editing',
			organiser: 'SEA Independent Film Awards',
			year: 2026,
			status: 'approved',
			author_name: 'Dewi Lestari',
		},
		{
			...contributorEntry,
			uid: 'w2',
			category: 'award',
			title: 'Honorable Mention',
			award_result: 'special_mention',
			organiser: 'ABC Independent Film Awards',
			year: 2025,
			status: 'waiting_approval',
			author_name: 'Dewi Lestari',
			viewer_can_edit: true,
		},
	],
	screening: [
		screening('s1', 'Manila Community Film Night', 2021),
		screening('s2', 'Kuala Lumpur Community Film Night', 2022),
		screening('s3', 'Bali Community Film Night', 2020),
		screening('s4', 'Hanoi Doc Week', 2019),
	],
	teaching: [
		{
			uid: 't1',
			category: 'teaching',
			title: 'MEDIA 214: Climate Stories of Southeast Asia',
			organiser: 'Universitas Nusantara Raya',
			country_label: 'Indonesia',
			year: 2021,
			author_name: 'Another Member',
			status: 'waiting_approval',
			viewer_sees_status: true,
			viewer_review_url: '/manage/film-impact/t1/review',
		},
	],
	academic: [
		{
			uid: 'a1',
			category: 'academic',
			title: 'Legacy media course',
			event_date: '2019-03-01',
			viewer_sees_status: false,
			viewer_can_edit: true,
		},
	],
	curated: [{ uid: 'c1', title: 'Climate Justice Watchlist', event_date: '2025-06-10' }],
	saves: {
		lastEventAt: '2026-05-28T08:00:00Z',
		totalCount: { saves: 181, playlists: 11 },
		playlists: ['One', 'Two', 'Three', 'Four'].map((name) => ({
			friendly_token: `p-${name}`,
			title: `Playlist ${name}`,
			url: `/playlists/p-${name}`,
			add_date: '2026-01-01T00:00:00Z',
			curator_name: `Curator ${name}`,
		})),
	},
};

function group(name) {
	return screen.getByRole('region', { name });
}

describe('CommunityImpactSection', () => {
	it('lists the impact groups beside the playlists column', () => {
		render(<CommunityImpactSection entries={entries} />);

		expect(screen.getByRole('heading', { name: "Film's Impact" })).toBeInTheDocument();
		expect(
			screen.getByText(
				'For filmmakers & viewers. A list of where the film has been screened, written about, taught, or recognised'
			)
		).toBeVisible();
		expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
			'Recognition',
			'Screened at',
			'Used in a course / class',
			'Playlists',
		]);
		expect(within(group('Recognition')).getByText('2')).toBeVisible();
		expect(within(group('Used in a course / class')).getByText('2')).toBeVisible();
		expect(within(group('Playlists')).getByText('11')).toBeVisible();
		expect(screen.queryByText('Climate Justice Watchlist')).not.toBeInTheDocument();
		expect(screen.queryByText('Where has this film made an impact?')).not.toBeInTheDocument();
	});

	it('shows each entry with its category details, year, and contributor', () => {
		render(<CommunityImpactSection entries={entries} />);

		const award = screen.getByRole('article', { name: 'Best Editing' });
		expect(within(award).getByText('SEA Independent Film Awards')).toBeVisible();
		expect(within(award).getByText('2026')).toBeVisible();
		expect(within(award).getByText('Dewi Lestari')).toBeVisible();
		expect(award).toHaveTextContent('Added by Dewi Lestari');

		expect(
			within(screen.getByRole('article', { name: 'Kuala Lumpur Community Film Night' })).getByText(
				'Organized by Kuala Lumpur Community Film Night Club'
			)
		).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'MEDIA 214: Climate Stories of Southeast Asia' })).getByText(
				'Universitas Nusantara Raya, Indonesia'
			)
		).toBeVisible();
		expect(within(screen.getByRole('article', { name: 'Legacy media course' })).getByText('2019')).toBeVisible();
	});

	it('shows status badges only to viewers who may see them', () => {
		render(<CommunityImpactSection entries={entries} />);

		expect(within(screen.getByRole('article', { name: 'Best Editing' })).getByText('APPROVED')).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'Honorable Mention' })).getByText('WAITING FOR REVIEW')
		).toBeVisible();
		expect(
			within(screen.getByRole('article', { name: 'Manila Community Film Night' })).queryByText(/APPROVED|WAITING/)
		).not.toBeInTheDocument();
	});

	it('previews three entries in a group and reveals the rest on VIEW ALL', async () => {
		const user = userEvent.setup();

		render(<CommunityImpactSection entries={entries} />);

		const screenings = group('Screened at');
		expect(
			within(screenings)
				.getAllByRole('article')
				.map((entry) => entry.getAttribute('aria-label'))
		).toEqual(['Kuala Lumpur Community Film Night', 'Manila Community Film Night', 'Bali Community Film Night']);
		expect(within(group('Recognition')).queryByRole('button', { name: 'VIEW ALL' })).not.toBeInTheDocument();

		const viewAll = within(screenings).getByRole('button', { name: 'VIEW ALL' });
		expect(viewAll).toHaveAttribute('aria-expanded', 'false');
		await user.click(viewAll);

		expect(within(screenings).getAllByRole('article')).toHaveLength(4);
		expect(within(screenings).getByRole('button', { name: 'VIEW LESS' })).toHaveAttribute('aria-expanded', 'true');
	});

	it('offers only the actions the viewer is allowed', () => {
		render(<CommunityImpactSection entries={entries} onDeleteImpact={vi.fn()} onEditImpact={vi.fn()} />);

		const approved = screen.getByRole('article', { name: 'Best Editing' });
		expect(within(approved).queryByRole('button', { name: 'Edit Best Editing' })).not.toBeInTheDocument();
		expect(within(approved).getByRole('button', { name: 'Delete Best Editing' })).toBeVisible();

		const waiting = screen.getByRole('article', { name: 'Honorable Mention' });
		expect(within(waiting).getByRole('button', { name: 'Edit Honorable Mention' })).toBeVisible();

		expect(
			within(screen.getByRole('article', { name: 'MEDIA 214: Climate Stories of Southeast Asia' })).getByRole(
				'link',
				{ name: 'Review MEDIA 214: Climate Stories of Southeast Asia' }
			)
		).toHaveAttribute('href', '/manage/film-impact/t1/review');

		// The form cannot edit legacy categories.
		expect(
			within(screen.getByRole('article', { name: 'Legacy media course' })).queryByRole('button', { name: /Edit/ })
		).not.toBeInTheDocument();
		expect(
			within(screen.getByRole('article', { name: 'Manila Community Film Night' })).queryByRole('button')
		).not.toBeInTheDocument();
	});

	it('edits an entry in the filled-in impact form', async () => {
		const user = userEvent.setup();
		const onEditImpact = vi.fn();

		render(<CommunityImpactSection entries={entries} onEditImpact={onEditImpact} />);

		await user.click(screen.getByRole('button', { name: 'Edit Honorable Mention' }));

		const dialog = screen.getByRole('dialog', { name: 'Edit community impact' });
		expect(within(dialog).getByRole('heading', { name: 'Edit this impact' })).toBeVisible();
		expect(within(dialog).getByRole('radio', { name: /^Recognition/ })).toBeChecked();
		expect(within(dialog).getByRole('radio', { name: /^Screening/ })).toBeDisabled();
		expect(within(dialog).getByLabelText('Given by')).toHaveValue('ABC Independent Film Awards');

		await user.clear(within(dialog).getByLabelText('Year'));
		await user.type(within(dialog).getByLabelText('Year'), '2024');
		await user.click(within(dialog).getByRole('button', { name: 'SAVE CHANGES' }));

		expect(onEditImpact).toHaveBeenCalledWith(entries.award[1], {
			category: 'award',
			title: 'Honorable Mention',
			award_result: 'special_mention',
			organiser: 'ABC Independent Film Awards',
			year: 2024,
			details: '',
			url: '',
		});
	});

	it('deletes an entry only after it is confirmed', async () => {
		const user = userEvent.setup();
		const onDeleteImpact = vi.fn();

		render(<CommunityImpactSection entries={entries} onDeleteImpact={onDeleteImpact} />);

		await user.click(screen.getByRole('button', { name: 'Delete Best Editing' }));
		await user.click(screen.getByRole('button', { name: 'CANCEL' }));
		expect(onDeleteImpact).not.toHaveBeenCalled();

		await user.click(screen.getByRole('button', { name: 'Delete Best Editing' }));
		expect(screen.getByRole('heading', { name: 'Delete this impact?' })).toBeVisible();
		await user.click(screen.getByRole('button', { name: 'DELETE' }));

		expect(onDeleteImpact).toHaveBeenCalledWith(entries.award[0]);
		expect(screen.queryByRole('heading', { name: 'Delete this impact?' })).not.toBeInTheDocument();
	});

	it('lists the playlists that hold the film', async () => {
		const user = userEvent.setup();

		render(<CommunityImpactSection entries={entries} />);

		const playlists = group('Playlists');
		expect(
			within(playlists)
				.getAllByRole('link')
				.map((link) => link.getAttribute('href'))
		).toEqual(['/playlists/p-One', '/playlists/p-Two', '/playlists/p-Three']);
		expect(within(playlists).getByText('Curator One')).toBeVisible();

		await user.click(within(playlists).getByRole('button', { name: 'VIEW ALL' }));

		expect(within(playlists).getAllByRole('link')).toHaveLength(4);
	});

	it('renders the empty state when there are no entries', () => {
		render(<CommunityImpactSection entries={{}} />);

		expect(screen.getByText('Where has this film made an impact?')).toBeVisible();
	});

	it('renders submitted-for-review feedback', () => {
		render(<CommunityImpactSection entries={{}} submitMessage="Submitted for review." />);

		expect(screen.getByText('Submitted for review.')).toBeVisible();
	});

	it('shows only the empty state ADD IMPACT button when there are no entries', () => {
		render(<CommunityImpactSection entries={{}} />);

		expect(screen.getAllByRole('button', { name: 'ADD IMPACT' })).toHaveLength(1);
	});

	it('shows the header ADD IMPACT button once impacts are listed', () => {
		render(<CommunityImpactSection entries={entries} />);

		expect(screen.getAllByRole('button', { name: 'ADD IMPACT' })).toHaveLength(1);
	});

	it('hides every ADD IMPACT button when adding is not allowed', () => {
		const { rerender } = render(<CommunityImpactSection canAdd={false} entries={{}} />);

		expect(screen.queryByRole('button', { name: 'ADD IMPACT' })).not.toBeInTheDocument();

		rerender(<CommunityImpactSection canAdd={false} entries={entries} />);

		expect(screen.queryByRole('button', { name: 'ADD IMPACT' })).not.toBeInTheDocument();
	});

	it('opens the add dialog and forwards submitted values', async () => {
		const user = userEvent.setup();
		const onAddImpact = vi.fn();

		render(<CommunityImpactSection entries={{}} onAddImpact={onAddImpact} />);

		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));
		await user.click(screen.getByRole('radio', { name: /^Article or Review/ }));
		await user.type(screen.getByLabelText('Title'), 'Films that changed the conversation');
		await user.type(screen.getByLabelText('Year'), '2023');
		await user.type(screen.getByLabelText('Created by'), 'Dewi Lestari');
		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(onAddImpact).toHaveBeenCalledWith({
			category: 'article',
			title: 'Films that changed the conversation',
			year: 2023,
			creator: 'Dewi Lestari',
			publication: '',
			details: '',
			url: '',
		});
	});

	it('clears a submit error when the add dialog is cancelled', async () => {
		const user = userEvent.setup();
		const onSubmitErrorClear = vi.fn();

		render(
			<CommunityImpactSection
				entries={{}}
				onSubmitErrorClear={onSubmitErrorClear}
				submitStatus="error"
				submitError={{ field: 'year', message: 'Enter a year between 1900 and 2026.' }}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));
		await user.click(screen.getByRole('button', { name: 'CANCEL' }));

		expect(onSubmitErrorClear).toHaveBeenCalledTimes(1);
	});

	it('forwards submit errors into the add dialog', async () => {
		const user = userEvent.setup();

		render(
			<CommunityImpactSection
				entries={{}}
				submitStatus="error"
				submitError={{
					field: 'url',
					message: 'Link is not trustworthy. Please use a secure HTTPS link.',
				}}
			/>
		);

		await user.click(screen.getByRole('button', { name: 'ADD IMPACT' }));

		expect(screen.getByText('Link is not trustworthy. Please use a secure HTTPS link.')).toBeVisible();
	});
});
