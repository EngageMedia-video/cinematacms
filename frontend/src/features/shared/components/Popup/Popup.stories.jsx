import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { Popup, PopupContent, PopupMain, PopupTop, PopupTrigger, usePopup } from './Popup';

const DOWNLOAD_OPTIONS = ['1080p - H264 (84 MB)', '720p - H264 (42 MB)', 'Original file (128 MB)'];

function PopupMenu() {
	return (
		<PopupMain>
			<nav aria-label="Download options" className="border border-border-strong-constant bg-bg-surface">
				<ul role="menu" className="m-0 list-none p-size-4">
					{DOWNLOAD_OPTIONS.map((option) => (
						<li key={option} role="none">
							<a
								href="#download"
								role="menuitem"
								className="body-body-14-medium block rounded-ds-4 px-size-12 py-size-10 text-text-strong no-underline transition-colors duration-150 hover:bg-cinemata-pacific-deep-50 focus:bg-cinemata-pacific-deep-50 focus:outline-none dark:hover:bg-cinemata-pacific-deep-800 dark:focus:bg-cinemata-pacific-deep-800"
							>
								{option}
							</a>
						</li>
					))}
				</ul>
			</nav>
		</PopupMain>
	);
}

function PopupExample({ className = '', style = null }) {
	const [contentRef] = usePopup();

	return (
		<div className="relative flex min-h-[280px] items-start justify-center bg-bg-page p-10">
			<PopupTrigger contentRef={contentRef}>
				<Button
					aria-label="Download"
					variant="secondary"
					icon={<Icon name="downloadMedia" className="text-cinemata-strait-blue-100" />}
					size="sm"
				>
					<Text
						as="span"
						variant="body-14-medium"
						className="text-neutral-50 dark:text-cinemata-strait-blue-100"
					>
						Download
					</Text>
					<Icon name="caretDown" className="ml-2 h-4 w-4" />
				</Button>
			</PopupTrigger>

			<PopupContent
				contentRef={contentRef}
				className={className}
				style={
					style || {
						position: 'absolute',
						top: '84px',
						right: '50%',
						transform: 'translateX(50%)',
					}
				}
			>
				<PopupMenu />
			</PopupContent>
		</div>
	);
}

const meta = {
	title: 'Components/Overlays/Popup',
	component: Popup,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Legacy-compatible shared popup primitives with Tailwind styling. Use `usePopup`, `PopupTrigger`, and `PopupContent` for imperative `toggle`, `tryToHide`, and `tryToShow` behavior.',
			},
		},
	},
	argTypes: {
		className: {
			control: 'text',
			description: 'Optional class applied to the popup surface.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		style: {
			control: false,
			description: 'Optional inline style applied to the popup surface.',
			table: {
				type: { summary: 'object' },
			},
		},
		children: {
			control: false,
			description: 'Popup body content.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
	},
	args: {
		className: '',
		style: null,
	},
};

export default meta;

export const Default = {
	render: (args) => <PopupExample {...args} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Download' });

		await userEvent.click(trigger);
		await expect(canvas.getByRole('menu')).toBeVisible();
		await expect(canvas.getByRole('menuitem', { name: 'Original file (128 MB)' })).toBeVisible();
	},
};

export const WithHeader = {
	render: (args) => {
		const [contentRef] = usePopup();

		return (
			<div className="relative flex min-h-[320px] items-start justify-center bg-bg-page p-10">
				<PopupTrigger contentRef={contentRef}>
					<Button variant="secondary" size="sm">
						Open popup
					</Button>
				</PopupTrigger>

				<PopupContent
					contentRef={contentRef}
					className={args.className}
					style={{
						position: 'absolute',
						top: '84px',
						right: '50%',
						transform: 'translateX(50%)',
					}}
				>
					<PopupTop>
						<Text as="p" variant="body-14-bold" className="text-text-on-primary">
							Media actions
						</Text>
					</PopupTop>
					<PopupMenu />
				</PopupContent>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'Open popup' }));
		await expect(canvas.getByText('Media actions')).toBeVisible();
	},
};

export const StaticSurface = {
	render: (args) => (
		<div className="flex min-h-[260px] items-center justify-center bg-bg-page p-10">
			<Popup {...args}>
				<PopupTop>
					<Text as="p" variant="body-14-bold" className="text-text-on-primary">
						Popup Header
					</Text>
				</PopupTop>
				<PopupMenu />
			</Popup>
		</div>
	),
};
