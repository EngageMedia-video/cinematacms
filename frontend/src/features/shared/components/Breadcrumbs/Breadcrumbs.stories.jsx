import { Breadcrumbs } from './Breadcrumbs';

export default {
	title: 'Components/Breadcrumbs',
	component: Breadcrumbs,
	args: {
		items: [
			{ label: 'Home', href: '/' },
			{ label: 'Analytics', href: '/analytics' },
			{ label: 'A film from our community' },
		],
	},
};
export const Default = {};
export const LongTitle = {
	args: {
		items: [
			{ label: 'Home', href: '/' },
			{
				label: 'A very long film title that should wrap without hiding the navigation or overflowing a narrow screen',
			},
		],
	},
};
