import { expect, within } from 'storybook/test';
import { FilmImpactReviewPage } from './FilmImpactReviewPage';

const config = {
	apiUrl: '/api/v1/manage_film_impact/story-impact',
	csrfToken: 'story-token',
	impactUid: 'story-impact',
	manageUrl: '/manage/film-impact',
};

const impact = {
	uid: 'story-impact',
	category: 'referenced',
	category_label: 'Referenced in Another Work',
	status: 'waiting_approval',
	status_label: 'Waiting for approval',
	title: '“Ang Kalikasan ay Nakikinig” (Nature Is Listening), mural by Kolektibong Pintura',
	year: 2024,
	creator: 'Kolektibong Pintura',
	medium: 'artwork',
	details: 'This 4×12 m public mural in Quezon City draws on the opening forest sequence of On Nature.',
	url: 'https://example.com/mural',
	add_date: '2026-05-01T10:00:00Z',
	media: { friendly_token: 'abc', title: 'On Nature', url: '/view?m=abc' },
	user: { username: 'contributor', name: 'Member - Impact Contributor' },
};

// The page reads and saves through the manager API; the story answers both from memory.
function withImpactApi(Story) {
	window.fetch = async (url, options = {}) => {
		const body = options.body ? JSON.parse(options.body) : {};
		const data = { ...impact, ...body, status: body.status ?? impact.status };
		return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
	};
	return <Story />;
}

const meta = {
	title: 'Features/Film Impact Review/FilmImpactReviewPage',
	component: FilmImpactReviewPage,
	decorators: [withImpactApi],
	parameters: { layout: 'fullscreen' },
	args: { config },
	render: (args) => (
		<div className="min-h-screen bg-bg-page">
			<FilmImpactReviewPage {...args} />
		</div>
	),
};

export default meta;

export const WaitingForReview = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(await canvas.findByLabelText('Made by')).toHaveValue('Kolektibong Pintura');
		await expect(canvas.getByRole('button', { name: 'APPROVE' })).toBeVisible();
	},
};

export const Mobile = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1',
		},
	},
};
