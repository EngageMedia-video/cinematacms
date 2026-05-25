import { expect, within } from 'storybook/test';
import { Text } from './Text';

const HEADING_VARIANTS = [
	'h1',
	'h1-regular',
	'h1-bold',
	'h2',
	'h2-regular',
	'h2-bold',
	'h3',
	'h3-regular',
	'h3-bold',
	'h4',
	'h4-regular',
	'h4-bold',
	'h5',
	'h5-regular',
	'h5-bold',
	'h6',
	'h6-regular',
	'h6-bold',
];

const BODY_VARIANTS = [
	'body-16',
	'body-16-medium',
	'body-14',
	'body-14-bold',
	'body-12',
	'body-12-medium',
	'body-12-bold',
	'caption-10',
];

const ALL_VARIANTS = [...HEADING_VARIANTS, ...BODY_VARIANTS];

const meta = {
	title: 'Components/Typography/Text',
	component: Text,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Unified text component for all typography variants. Body and caption variants default to `color="body"` (`pacific-deep/700` light, `strait-blue/50` dark). Use `color="meta"` for secondary metadata text (`pacific-deep/400/300`) and `color="description"` for long-form card descriptions (`pacific-deep/700/300`). Heading variants render the matching `<h{x}>` element and carry no default color — pass color via `className`.',
			},
		},
	},
	args: {
		children: 'Documentary filmmaking for social change across Asia and the Pacific.',
		variant: 'body-14',
	},
	argTypes: {
		children: {
			control: 'text',
			description: 'Text content.',
		},
		variant: {
			control: 'select',
			options: ALL_VARIANTS,
			description:
				'Typography variant. Heading variants (`h1`–`h6`) default to the matching semantic element and carry no default color. Body variants default to `<p>` with `color="body"`.',
			table: {
				type: { summary: ALL_VARIANTS.join(' | ') },
				defaultValue: { summary: "'body-14'" },
			},
		},
		color: {
			control: 'radio',
			options: ['body', 'meta', 'description'],
			description:
				'Semantic color preset. `body` = `pacific-deep/700` light, `strait-blue/50` dark. `meta` = `pacific-deep/400/300`. `description` = `pacific-deep/700/300`. Omit on heading variants and supply color via `className` instead.',
			table: {
				type: { summary: "'body' | 'meta' | 'description'" },
				defaultValue: { summary: "'body' (body/caption variants), none (heading variants)" },
			},
		},
		as: {
			control: 'select',
			options: ['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'label', 'dt', 'dd'],
			description:
				'Override the rendered HTML element. Heading variants already default to the matching `<h{x}>` — use this only when semantic and visual hierarchy must differ.',
			table: {
				type: { summary: 'keyof JSX.IntrinsicElements' },
			},
		},
		className: {
			control: 'text',
			description:
				'Extra classes merged after the defaults. Use for color on heading variants, or layout utilities like `m-0`.',
		},
	},
	render: (args) => (
		<div className="max-w-xl bg-bg-page p-6">
			<Text {...args} />
		</div>
	),
};

export default meta;

// ── Body ──────────────────────────────────────────────────

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const el = canvas.getByText(/Documentary filmmaking/);

		await expect(el).toBeVisible();
		await expect(el).toHaveClass('body-body-14-regular');
		await expect(el).toHaveClass('text-text-primary');
	},
};

export const Body16 = {
	args: {
		variant: 'body-16',
		children: 'Larger body text for introductory content or lead paragraphs.',
	},
};

export const Body16Medium = {
	args: {
		variant: 'body-16-medium',
		children: 'Medium-weight body text for slightly emphasised prose.',
	},
};

export const Body14Bold = {
	args: {
		variant: 'body-14-bold',
		children: 'Bold body text for inline labels or call-out text.',
	},
};

export const Body12 = {
	args: {
		variant: 'body-12',
		children: 'Philippines · 12,345 views',
	},
};

export const Caption10 = {
	args: {
		variant: 'caption-10',
		children: 'SEE ALL',
		className: 'uppercase tracking-wide',
	},
};

export const MetaColor = {
	name: 'color="meta" (secondary metadata)',
	render: () => (
		<div className="max-w-sm bg-bg-page p-6">
			<p className="m-0 flex flex-wrap items-center gap-x-1">
				<Text as="span" variant="body-12" color="meta">
					Philippines
				</Text>
				<Text as="span" variant="body-12" color="meta" aria-hidden="true">
					·
				</Text>
				<Text as="span" variant="body-12" color="meta">
					12,345 views
				</Text>
			</p>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const views = canvas.getByText('12,345 views');

		await expect(views).toHaveClass('text-text-muted');
		await expect(views).not.toHaveClass('text-text-primary');
	},
};

export const DescriptionColor = {
	name: 'color="description" (card descriptions)',
	render: () => (
		<div className="max-w-sm bg-bg-surface p-6">
			<Text color="description">
				A synopsis loaded from the media description, tuned to stay readable on light surfaces and softer on
				dark cards.
			</Text>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const description = canvas.getByText(/A synopsis loaded/);

		await expect(description).toHaveClass('text-text-description');
		await expect(description).not.toHaveClass('text-text-primary');
	},
};

// ── Headings ──────────────────────────────────────────────

export const HeadingH1 = {
	name: 'Heading H1',
	args: {
		variant: 'h1',
		children: 'Asia-Pacific Social Issue Cinema',
		className: 'text-text-primary',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const el = canvas.getByRole('heading', { level: 1 });

		await expect(el).toBeVisible();
		await expect(el).toHaveClass('heading-h1-56-medium');
	},
};

export const HeadingH2 = {
	name: 'Heading H2',
	args: {
		variant: 'h2',
		children: 'Featured Films',
		className: 'text-text-primary',
	},
};

export const HeadingH4 = {
	name: 'Heading H4',
	args: {
		variant: 'h4',
		children: 'Most Popular',
		className: 'text-text-primary',
	},
};

export const HeadingH6 = {
	name: 'Heading H6',
	args: {
		variant: 'h6',
		children: 'The Silent Hours',
		className: 'text-text-primary',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const el = canvas.getByRole('heading', { level: 6 });

		await expect(el).toHaveClass('heading-h6-20-medium');
	},
};

export const HeadingSemanticOverride = {
	name: 'h6 visual, h2 semantic',
	args: {
		variant: 'h6',
		as: 'h2',
		children: 'Card Title (h6 look, h2 in the DOM)',
		className: 'text-text-primary',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const el = canvas.getByRole('heading', { level: 2 });

		await expect(el).toHaveClass('heading-h6-20-medium');
	},
};

// ── All variants ──────────────────────────────────────────

export const AllHeadings = {
	render: () => (
		<div className="flex max-w-2xl flex-col gap-4 bg-bg-page p-6">
			{['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((v) => (
				<Text key={v} variant={v} className="text-text-primary">
					{v} — Documentary filmmaking for social change
				</Text>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('heading', { level: 1 })).toHaveClass('heading-h1-56-medium');
		await expect(canvas.getByRole('heading', { level: 6 })).toHaveClass('heading-h6-20-medium');
	},
};

export const AllBodyVariants = {
	render: () => (
		<div className="flex max-w-lg flex-col gap-3 bg-bg-page p-6">
			{BODY_VARIANTS.map((v) => (
				<Text key={v} variant={v}>
					{v} — Documentary filmmaking for social change
				</Text>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText(/body-16 —/)).toHaveClass('body-body-16-regular');
		await expect(canvas.getByText(/body-14 —/)).toHaveClass('body-body-14-regular');
		await expect(canvas.getByText(/caption-10 —/)).toHaveClass('caption-caption-10-regular');
	},
};

export const AsSpan = {
	name: 'as="span" (inline)',
	args: {
		as: 'span',
		variant: 'body-12',
		children: 'inline text node',
	},
	render: (args) => (
		<div className="max-w-sm bg-bg-page p-6">
			<p className="body-body-14-regular text-text-primary">
				This paragraph contains <Text {...args} /> rendered as a span.
			</p>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const el = canvas.getByText('inline text node');

		await expect(el.tagName).toBe('SPAN');
	},
};
