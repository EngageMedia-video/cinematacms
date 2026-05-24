import '../src/static/lib/material-icons/material-icons.css';
import '../src/static/lib/Inter/inter.css';
import '../src/static/lib/BarlowSemiCondensed/barlow-semi-condensed.css';
import '../src/features/shared/components/storybook-preview.scss';
import '../src/static/css/tailwind.css';
import { themes } from 'storybook/theming';

export const globalTypes = {
	colorMode: {
		name: 'Color mode',
		description: 'Preview the application in light or dark mode',
		toolbar: {
			icon: 'mirror',
			items: [
				{ value: 'light', title: 'Light' },
				{ value: 'dark', title: 'Dark' },
			],
			dynamicTitle: true,
		},
	},
};

export const initialGlobals = {
	colorMode: 'dark',
};

export const parameters = {
	layout: 'centered',
	controls: {
		matchers: {
			color: /(background|color)$/i,
			date: /Date$/i,
		},
	},
	options: {
		storySort: {
			order: [
				'Introduction',
				['Overview', 'Guide'],
				'Components',
				['Actions', 'Display', 'Inputs', 'Overlays'],
				'Notification',
				['Dialog', 'Item'],
			],
		},
	},
	docs: {
		theme: themes.dark,
	},
};

export const decorators = [
	(storyFn, context) => {
		if (typeof document !== 'undefined') {
			const mode = context.globals.colorMode === 'light' ? 'light' : 'dark';

			document.documentElement.classList.toggle('dark', mode === 'dark');
			document.body.classList.toggle('light_theme', mode === 'light');
			document.body.classList.toggle('dark_theme', mode === 'dark');
			document.documentElement.style.colorScheme = mode;
		}

		return storyFn();
	},
];
