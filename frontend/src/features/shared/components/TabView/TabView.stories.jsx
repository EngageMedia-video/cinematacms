import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { TabContent, TabView } from './TabView';

function TabViewFrame({ children }) {
	return <div className="w-full min-w-[320px] max-w-[720px] bg-cinemata-neutral-100 p-6 dark:bg-cinemata-pacific-deep-950">{children}</div>;
}

const meta = {
	title: 'Components/Inputs/Tab View',
	component: TabView,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Shared tab view with a full-width scrollable tab bar and content panels generated directly from `TabContent` children. Basic usage: `<TabView><TabContent title=\"...\" content={...} /></TabView>`. Use `selectedTab` when you want to control the active tab from outside the component.',
			},
		},
	},
	argTypes: {
		selectedTab: {
			control: 'text',
			description:
				'Controlled selected tab identifier. Match this with a `TabContent` `value`, or let titles auto-generate identifiers.',
			table: {
				type: { summary: 'string' },
			},
		},
		defaultSelectedTab: {
			control: 'text',
			description: 'Initial uncontrolled selected tab identifier.',
			table: {
				type: { summary: 'string' },
			},
		},
		onSelectedTabChange: {
			action: 'selected-tab-changed',
			description: 'Called with the next selected tab identifier.',
			table: {
				type: { summary: '(tabId: string) => void' },
			},
		},
		tabMode: {
			control: 'radio',
			options: ['fill', 'wrap'],
			description:
				'Controls whether tabs distribute available width equally or size to their content like Android `fixed` vs `scrollable` tabs.',
			table: {
				type: { summary: "'fill' | 'wrap'" },
				defaultValue: { summary: "'fill'" },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra classes applied to the outer component wrapper.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		listClassName: {
			control: 'text',
			description: 'Optional extra classes applied to the generated tab bar container.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		triggerClassName: {
			control: 'text',
			description: 'Optional extra classes applied to every generated tab trigger.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		panelClassName: {
			control: 'text',
			description: 'Optional extra classes applied to the active generated tab panel.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		'aria-label': {
			control: 'text',
			description: 'Accessible label announced for the tab list.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Tabs'" },
			},
		},
	},
	args: {
		defaultSelectedTab: 'single-film-upload',
		tabMode: 'fill',
		'aria-label': 'Upload mode',
	},
};

export default meta;

export const Default = {
	render: (args) => (
		<TabViewFrame>
			<TabView {...args}>
				<TabContent
					title="Single Film Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Upload one title with its own metadata and assets.
						</p>
					}
				/>
				<TabContent
					title="Bulk Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Import multiple items in one batch workflow.
						</p>
					}
				/>
			</TabView>
		</TabViewFrame>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const selectedTab = canvas.getByRole('tab', { name: 'Single Film Upload' });

		await expect(selectedTab).toBeVisible();
		await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
		await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
			'Upload one title with its own metadata and assets.'
		);
	},
};

export const Controlled = {
	args: {
		selectedTab: 'single-film-upload',
	},
	render: (args) => {
		const [selectedTab, setSelectedTab] = useState(args.selectedTab);

		return (
			<TabViewFrame>
				<TabView
					{...args}
					selectedTab={selectedTab}
					onSelectedTabChange={(nextValue) => {
						setSelectedTab(nextValue);
						args.onSelectedTabChange?.(nextValue);
					}}
				>
					<TabContent
						title="Single Film Upload"
						content={
							<p className="body-body-14-regular text-cinemata-white">
								Upload one title with its own metadata and assets.
							</p>
						}
					/>
					<TabContent
						title="Bulk Upload"
						content={
							<p className="body-body-14-regular text-cinemata-white">
								Import multiple items in one batch workflow.
							</p>
						}
					/>
				</TabView>
			</TabViewFrame>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const bulkTab = canvas.getByRole('tab', { name: 'Bulk Upload' });

		await userEvent.click(bulkTab);
		await expect(bulkTab).toHaveAttribute('aria-selected', 'true');
		await expect(canvas.getByRole('tabpanel')).toHaveTextContent('Import multiple items in one batch workflow.');
	},
};

export const Overflow = {
	render: (args) => (
		<TabViewFrame>
			<TabView {...args} aria-label="Upload workflow" tabMode="wrap">
				<TabContent
					title="Single Film Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Upload one title with its own metadata and assets.
						</p>
					}
				/>
				<TabContent
					title="Bulk Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Import multiple items in one batch workflow.
						</p>
					}
				/>
				<TabContent
					title="Schedule Release"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Set publish timing for upcoming media.
						</p>
					}
				/>
				<TabContent
					title="Review Settings"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Confirm the selected upload configuration.
						</p>
					}
				/>
			</TabView>
		</TabViewFrame>
	),
};

export const WrapContent = {
	args: {
		tabMode: 'wrap',
	},
	render: (args) => (
		<TabViewFrame>
			<TabView {...args}>
				<TabContent
					title="Single Film Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Upload one title with its own metadata and assets.
						</p>
					}
				/>
				<TabContent
					title="Bulk Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">
							Import multiple items in one batch workflow.
						</p>
					}
				/>
			</TabView>
		</TabViewFrame>
	),
};

export const WithCustomValues = {
	render: (args) => (
		<TabViewFrame>
			<TabView {...args} defaultSelectedTab="bulk">
				<TabContent
					value="single"
					title="Single Film Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">Custom keyed single upload panel.</p>
					}
				/>
				<TabContent
					value="bulk"
					title="Bulk Upload"
					content={
						<p className="body-body-14-regular text-cinemata-white">Custom keyed bulk upload panel.</p>
					}
				/>
			</TabView>
		</TabViewFrame>
	),
};
