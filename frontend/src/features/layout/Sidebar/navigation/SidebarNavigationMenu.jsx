import React, { useContext } from 'react';
import urlParse from 'url-parse';

import LinksContext from '../../../../static/js/contexts/LinksContext';
import UserContext from '../../../../static/js/contexts/UserContext';
import SidebarContext from '../../../../static/js/contexts/SidebarContext';
import { NavigationMenuList } from './NavigationMenuList';
import PageStore from '../../../../static/js/pages/_PageStore.js';

export function SidebarNavigationMenu() {
	const links = useContext(LinksContext);
	const user = useContext(UserContext);
	const sidebar = useContext(SidebarContext);
	const currentUrl = urlParse(window.location.href);
	const currentHostPath = (currentUrl.host + currentUrl.pathname).replace(/\/+$/, '');

	function formatItems(items) {
		return items.map((item) => {
			const url = urlParse(item.link);
			const urlTarget = (url.host + url.pathname).replace(/\/+$/, '');
			const active = currentHostPath === urlTarget;

			return {
				active,
				itemType: 'link',
				link: item.link || '#',
				icon: item.icon || null,
				iconPos: 'left',
				text: item.text || item.link || '#',
				itemAttr: {
					className: item.className || '',
				},
			};
		});
	}

	function MainMenuFirstSection() {
		const items = [];

		if (!sidebar.hideHomeLink) {
			items.push({
				link: links.home,
				icon: 'home',
				text: 'Home',
				className: 'nav-item-home',
			});
		}

		if (PageStore.get('config-enabled').pages.featured && PageStore.get('config-enabled').pages.featured.enabled) {
			items.push({
				link: links.featured,
				icon: 'featured',
				text: PageStore.get('config-enabled').pages.featured.title,
				className: 'nav-item-featured',
			});
		}

		if (PageStore.get('config-enabled').pages.latest && PageStore.get('config-enabled').pages.latest.enabled) {
			items.push({
				link: links.latest,
				icon: 'recentlyUpload',
				text: PageStore.get('config-enabled').pages.latest.title,
				className: 'nav-item-latest',
			});
		}

		if (PageStore.get('config-enabled').pages.members && PageStore.get('config-enabled').pages.members.enabled) {
			items.push({
				link: links.members,
				icon: 'members',
				text: PageStore.get('config-enabled').pages.members.title,
				className: 'nav-item-members',
			});
		}

		const extraItems = PageStore.get('config-contents').sidebar.mainMenuExtraNew.items;
		extraItems.forEach((navitem) => {
			items.push({
				link: navitem.link,
				icon: navitem.icon,
				text: navitem.text,
				className: navitem.className,
			});
		});

		return items.length ? <NavigationMenuList key="main-first" items={formatItems(items)} /> : null;
	}

	function MainMenuSecondSection() {
		const items = [];

		if (!user.is.anonymous) {
			if (user.can.addMedia) {
				items.push({
					link: links.user.addMedia,
					icon: 'myMedia',
					text: 'My Media & Playlist',
					className: 'nav-item-upload-media',
				});
			}
		}

		return items.length ? <NavigationMenuList key="main-second" items={formatItems(items)} /> : null;
	}

	function UserMenuSection() {
		const items = [];

		if (PageStore.get('config-enabled').pages.history && PageStore.get('config-enabled').pages.history.enabled) {
			items.push({
				link: links.user.history,
				icon: 'clock',
				text: PageStore.get('config-enabled').pages.history.title,
				className: 'nav-item-history',
			});
		}

		if (
			user.can.likeMedia &&
			PageStore.get('config-enabled').pages.liked &&
			PageStore.get('config-enabled').pages.liked.enabled
		) {
			items.push({
				link: links.user.liked,
				icon: 'thumbUp',
				text: PageStore.get('config-enabled').pages.liked.title,
				className: 'nav-item-liked',
			});
		}

		return items.length ? <NavigationMenuList key="user" items={formatItems(items)} /> : null;
	}

	function CustomMenuSection() {
		const items = PageStore.get('config-contents').sidebar.navMenuNew.items;

		return items.length ? <NavigationMenuList key="custom" items={formatItems(items)} /> : null;
	}

	function AdminMenuSection() {
		const items = [];

		if (user.can.manageMedia) {
			items.push({
				link: links.manage.media,
				icon: 'gear',
				text: 'Manage media',
				className: 'nav-item-manage-media',
			});
		}

		if (user.can.manageUsers) {
			items.push({
				link: links.manage.users,
				icon: 'gear',
				text: 'Manage users',
				className: 'nav-item-manage-users',
			});
		}

		if (user.can.manageComments) {
			items.push({
				link: links.manage.comments,
				icon: 'gear',
				text: 'Manage comments',
				className: 'nav-item-manage-comments',
			});
		}

		return items.length ? <NavigationMenuList key="admin" items={formatItems(items)} /> : null;
	}

	const sections = [
		MainMenuFirstSection(),
		MainMenuSecondSection(),
		// UserMenuSection(),
		CustomMenuSection(),
		AdminMenuSection(),
	].filter(Boolean);

	return sections.length ? (
		<div className="divide-y divide-sidebar-nav-border">
			{sections.map((section, index) => (
				<div key={index}>{section}</div>
			))}
		</div>
	) : null;
}
