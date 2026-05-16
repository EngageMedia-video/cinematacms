import { useEffect, useRef, useState } from 'react';
import {
	ensureSidebarStoryMediaCMS,
	LazySidebarComponent,
	SidebarStorySurface,
} from '../storybook/sidebarStoryHelpers';
import * as LayoutActions from '../actions/LayoutActions';

function SidebarStoryPreview(props) {
	return <LazySidebarComponent loadComponent={() => import('../shell/Sidebar')} exportName="Sidebar" {...props} />;
}

function SidebarStoryContent() {
	const storeRef = useRef(null);
	const [sidebarVisible, setSidebarVisible] = useState(false);

	useEffect(() => {
		ensureSidebarStoryMediaCMS();

		let handler;
		import('../../../../../static/js/stores/LayoutStore.js').then((mod) => {
			const store = mod.default;
			storeRef.current = store;
			setSidebarVisible(store.get('visible-sidebar'));
			handler = () => setSidebarVisible(store.get('visible-sidebar'));
			store.on('sidebar-visibility-change', handler);
		});

		return () => {
			if (storeRef.current && handler) {
				storeRef.current.removeListener('sidebar-visibility-change', handler);
			}
		};
	}, []);

	return (
		<div
			className={`min-h-screen p-10 transition-[margin-left] duration-200 ${sidebarVisible ? 'ml-[280px]' : 'ml-0'}`}
		>
			<p className="caption-caption-10-semibold uppercase tracking-[0.18em] text-cinemata-pacific-deep-500 dark:text-cinemata-strait-blue-300">
				Preview Shell
			</p>
			<h2 className="heading-h4-32-medium mt-4 text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50">
				Sidebar baseline for the upcoming revamp
			</h2>
			<p className="body-body-16-regular mt-3 max-w-xl text-cinemata-pacific-deep-600 dark:text-cinemata-pacific-deep-300">
				This canvas keeps the copied sidebar fixed on the left and gives the story enough viewport space to
				preview its current production spacing, footer behavior, and navigation stack.
			</p>
			<button onClick={LayoutActions.toggleSidebar}>Test</button>
		</div>
	);
}

const meta = {
	title: 'Components/Overlays/Sidebar/Sidebar',
	component: SidebarStoryPreview,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Current shared sidebar shell copied from the legacy sidebar. This is the full baseline preview before the revamp work starts.',
			},
		},
	},
	decorators: [
		(Story) => (
			<SidebarStorySurface>
				<Story />
				<SidebarStoryContent />
			</SidebarStorySurface>
		),
	],
};

export default meta;

export const Default = {};
