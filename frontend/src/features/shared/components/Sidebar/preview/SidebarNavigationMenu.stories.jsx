import { LazySidebarComponent, SidebarPanel } from '../storybook/sidebarStoryHelpers';

function SidebarNavigationMenuStory(props) {
	return (
		<LazySidebarComponent
			loadComponent={() => import('../navigation/SidebarNavigationMenu')}
			exportName="SidebarNavigationMenu"
			{...props}
		/>
	);
}

const meta = {
	title: 'Components/Overlays/Sidebar/Sidebar Navigation Menu',
	component: SidebarNavigationMenuStory,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Main sidebar navigation stack copied from the legacy sidebar. This story isolates the generated menu sections from the full fixed sidebar shell.',
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
};

export default meta;

export const Default = {};
