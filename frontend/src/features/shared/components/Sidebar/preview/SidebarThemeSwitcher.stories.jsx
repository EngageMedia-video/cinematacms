import { LazySidebarComponent, SidebarPanel } from '../storybook/sidebarStoryHelpers';

function SidebarThemeSwitcherStory(props) {
	return (
			<LazySidebarComponent
				loadComponent={() => import('../theme/SidebarThemeSwitcher')}
				exportName="SidebarThemeSwitcher"
				{...props}
		/>
	);
}

const meta = {
	title: 'Components/Overlays/Sidebar/Theme Switcher',
	component: SidebarThemeSwitcherStory,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Theme switcher section copied from the legacy sidebar. It keeps the current legacy switch behavior available as a separate revamp target.',
			},
		},
	},
	decorators: [(Story) => <SidebarPanel><Story /></SidebarPanel>],
};

export default meta;

export const Default = {};
