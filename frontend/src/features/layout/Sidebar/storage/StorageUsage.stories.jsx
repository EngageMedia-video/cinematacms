import { StorageUsage } from './StorageUsage';
import { SidebarPanel } from '../storybook/sidebarStoryHelpers';

const meta = {
	title: 'Components/Overlays/Sidebar/Storage Usage',
	component: StorageUsage,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<SidebarPanel>
				<Story />
			</SidebarPanel>
		),
	],
};

export default meta;

export const UserUsage = {
	args: {
		scope: 'user',
		usedBytes: 1024 ** 3 * 12.3,
	},
};

export const SiteHosted = {
	args: {
		scope: 'site',
		usedBytes: 1024 ** 4 * 4.8,
	},
};

export const Unavailable = {
	args: {
		scope: 'user',
		usedBytes: null,
	},
};
