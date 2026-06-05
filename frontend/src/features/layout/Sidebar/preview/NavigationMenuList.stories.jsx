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
		title: {
			control: 'text',
			description:
				'Optional section title rendered as a heading above the list and used as the nav accessible name.',
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

export const WithSectionTitle = {
	args: {
		title: 'Manage',
		items: [
			{
				itemType: 'link',
				link: '/manage/media',
				icon: 'gear',
				text: 'Media',
				itemAttr: { className: 'nav-item-manage-media' },
			},
			{
				itemType: 'link',
				link: '/manage/users',
				icon: 'gear',
				text: 'Users',
				itemAttr: { className: 'nav-item-manage-users' },
			},
			{
				itemType: 'link',
				link: '/manage/comments',
				icon: 'gear',
				text: 'Comments',
				itemAttr: { className: 'nav-item-manage-comments' },
			},
			{
				itemType: 'link',
				link: '/manage/film-impact',
				icon: 'gear',
				text: 'Film Impact',
				itemAttr: { className: 'nav-item-manage-film-impact' },
			},
		],
	},
};
