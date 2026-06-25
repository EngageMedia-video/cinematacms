import { render, screen } from '@testing-library/react';
import { QuickPreview } from './QuickPreview';

const samplePoster =
	'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"%3E%3Crect width="160" height="90" fill="%23102746"/%3E%3C/svg%3E';

describe('QuickPreview', () => {
	it('renders the titled panel and the media card from the supplied fields', () => {
		render(
			<QuickPreview
				title="Samtang Naghulat Ko Nga"
				thumbnailUrl={samplePoster}
				durationLabel="23:05"
				category={{ title: 'FILM', color: 'coral-reef-700' }}
				subtitle="CCP Film, Broadcast and New Media"
				country="Philippines"
				views={200}
			/>
		);

		expect(screen.getByRole('region', { name: 'Quick preview' })).toBeVisible();
		expect(screen.getByRole('heading', { name: 'Quick Preview' })).toBeVisible();
		expect(screen.getByText('Samtang Naghulat Ko Nga')).toBeVisible();
		expect(screen.getByText('FILM')).toBeVisible();
		expect(screen.getByText('23:05')).toBeVisible();
		expect(screen.getByText('Philippines')).toBeVisible();

		const subtitle = screen.getByText('CCP Film, Broadcast and New Media');
		expect(subtitle).toHaveClass('text-text-link');

		const image = screen.getByRole('img', { name: 'Samtang Naghulat Ko Nga thumbnail' });
		expect(image).toHaveAttribute('src', samplePoster);
	});

	it('formats the view count with a thousands separator', () => {
		render(<QuickPreview title="A" views={12345} />);

		expect(screen.getByText('12,345 views')).toBeVisible();
	});

	it('renders a selected video frame over the poster when supplied', () => {
		render(
			<QuickPreview
				title="A"
				thumbnailUrl={samplePoster}
				thumbnailFrame={{ index: 1, rowsInSheet: 3, spritesUrl: '/sprites.jpg' }}
			/>
		);

		expect(screen.getByRole('img', { name: 'A selected video frame' })).toBeVisible();
	});

	it('falls back to placeholders while fields are empty', () => {
		render(<QuickPreview />);

		expect(screen.getByText('Untitled media')).toBeVisible();
		// No country/views supplied -> the metadata row is omitted entirely.
		expect(screen.queryByText('views', { exact: false })).not.toBeInTheDocument();

		const image = screen.getByRole('img', { name: 'Thumbnail preview' });
		expect(image.getAttribute('src')).toMatch(/^data:image\/gif/);
	});

	it('omits the badge when no category is provided', () => {
		render(<QuickPreview title="A" subtitle="Studio" country="Philippines" views={5} />);

		expect(screen.queryByText('FILM')).not.toBeInTheDocument();
		expect(screen.getByText('5 views')).toBeVisible();
	});
});
