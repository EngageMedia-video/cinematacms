import { NavigationMenuList } from '../navigation/NavigationMenuList';
import { SidebarPanel } from '../storybook/sidebarStoryHelpers';

const ITEMS = [
	{
		active: true,
		itemType: 'link',
		link: '/featured',
		icon: 'star',
		text: 'Featured',
		itemAttr: {
			className: 'nav-item-featured',
		},
	},
	{
		itemType: 'link',
		link: '/latest',
		icon: 'new_releases',
		text: 'Recent Uploads',
		itemAttr: {
			className: 'nav-item-latest',
		},
	},
	{
		itemType: 'link',
		link: '/topics',
		icon: 'topic',
		text: 'Topics',
		itemAttr: {
			className: 'nav-item-topics',
		},
	},
];

const meta = {
	title: 'Components/Overlays/Sidebar/Navigation Menu List',
	component: NavigationMenuList,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Legacy sidebar navigation list copied into the shared sidebar folder. Use this story to preview spacing, active state, and icon alignment.',
			},
		},
	},
	decorators: [
		(Story) => (
			<SidebarPanel>
				<Story />
			</SidebarPanel>
		),
	],
	argTypes: {
		removeVerticalPadding: {
			control: 'boolean',
			description: 'Removes the vertical padding wrapper used by the legacy menu list.',
		},
		items: {
			control: 'object',
			description: 'Navigation item objects rendered by the legacy list.',
		},
	},
	args: {
		items: ITEMS,
		removeVerticalPadding: false,
	},
};

export default meta;

export const Default = {};

export const WithoutVerticalPadding = {
	args: {
		removeVerticalPadding: true,
	},
};
