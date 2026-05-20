import { NavigationMenuListItem } from '../navigation/NavigationMenuList';
import { SidebarPanel, SidebarStorySurface } from '../storybook/sidebarStoryHelpers';

const navigationItemArgs = {
	itemType: 'link',
	link: '/featured',
	icon: 'star',
	text: 'Featured',
	active: false,
};

function NavigationItemPreview({ label, itemProps }) {
	return (
		<div>
			<p className="body-body-12-regular mb-3 text-content-body">{label}</p>
			<div className="w-[240px] rounded-sm bg-surface-sidebar p-3">
				<div className="py-0">
					<nav>
						<ul className="m-0 list-none p-0">
							<NavigationMenuListItem {...navigationItemArgs} {...itemProps} />
						</ul>
					</nav>
				</div>
			</div>
		</div>
	);
}

const meta = {
	title: 'Components/Overlays/Sidebar/Navigation Item',
	component: NavigationMenuListItem,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Single sidebar navigation row copied from the legacy navigation menu. This isolates the row state before the sidebar revamp.',
			},
		},
	},
	decorators: [
		(Story, context) => {
			if (context.name === 'State Comparison') {
				return (
					<SidebarStorySurface className="flex items-start justify-center p-8">
						<Story />
					</SidebarStorySurface>
				);
			}

			return (
				<SidebarPanel>
					<div className="py-3">
						<nav>
							<ul className="m-0 list-none p-0">
								<Story />
							</ul>
						</nav>
					</div>
				</SidebarPanel>
			);
		},
	],
	argTypes: {
		text: {
			control: 'text',
			description: 'Visible navigation item label.',
		},
		icon: {
			control: 'text',
			description: 'Material icon name shown beside the label.',
		},
		link: {
			control: 'text',
			description: 'Destination URL used when the item type is `link`.',
		},
		active: {
			control: 'boolean',
			description: 'Whether the item should render in its active link state.',
		},
		itemType: {
			control: 'radio',
			options: ['link', 'button', 'open-subpage', 'label', 'div'],
			description: 'Legacy item renderer variant.',
		},
	},
	args: {
		...navigationItemArgs,
	},
};

export default meta;

export const Default = {};

export const Hover = {
	args: {
		itemAttr: {
			className: 'is-hovered',
		},
	},
};

export const Active = {
	args: {
		active: true,
	},
};

export const StateComparison = {
	name: 'State Comparison',
	parameters: {
		controls: {
			disable: true,
		},
		docs: {
			description: {
				story: 'Compares the sidebar navigation item states from left to right: default, hover, and active.',
			},
		},
	},
	render: () => (
		<div className="flex flex-wrap gap-6">
			<NavigationItemPreview label="Default" itemProps={{}} />
			<NavigationItemPreview
				label="Hover"
				itemProps={{
					itemAttr: {
						className: 'is-hovered',
					},
				}}
			/>
			<NavigationItemPreview label="Active" itemProps={{ active: true }} />
		</div>
	),
};

export const ButtonItem = {
	args: {
		itemType: 'button',
		icon: 'settings',
		text: 'Settings',
		active: false,
	},
};
