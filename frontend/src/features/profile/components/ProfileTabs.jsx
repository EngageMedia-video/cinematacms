import { TabContent, TabView } from '../../shared/components';

export function ProfileTabs({ activeTab, tabs }) {
	return (
		<TabView
			selectedTab={activeTab}
			tabMode="wrap"
			aria-label="Profile sections"
			className="w-full"
			listClassName="rounded-none rounded-tl-ds-8 rounded-tr-ds-8"
			triggerClassName="min-w-max no-underline text-text-tab-trigger"
			triggerSelectedColor="bg-bg-tab-trigger-selected"
		>
			{tabs.map((tab) => (
				<TabContent key={tab.id} value={tab.id} title={tab.label} href={tab.href}>
					<span />
				</TabContent>
			))}
		</TabView>
	);
}
