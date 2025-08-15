import React, { useContext } from 'react';
import urlParse from 'url-parse';

import LinksContext from '../../contexts/LinksContext';
// import ApiUrlContext from '../../contexts/ApiUrlContext';
import UserContext from '../../contexts/UserContext';
// import ThemeContext from '../../contexts/ThemeContext';
import SidebarContext from '../../contexts/SidebarContext';

import { NavigationMenuList } from './NavigationMenuList';

import PageStore from '../../pages/_PageStore.js';

export function SidebarNavigationMenu() {

    const links = useContext(LinksContext);
    // const apiUrl = useContext( ApiUrlContext );
    const user = useContext(UserContext);
    // const theme = useContext( ThemeContext );
    const sidebar = useContext(SidebarContext);

    const currentUrl = urlParse(window.location.href);
    const currentHostPath = (currentUrl.host + currentUrl.pathname).replace(/\/+$/, '');

    function formatItems(items) {

        return items.map(item => {

            const url = urlParse(item.link);
            const active = currentHostPath === url.host + url.pathname;

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
                text: "Home",
                className: 'nav-item-home',
            });
        }

        if (PageStore.get('config-enabled').pages.featured && PageStore.get('config-enabled').pages.featured.enabled) {
            items.push({
                link: links.featured,
                icon: 'star',
                text: PageStore.get('config-enabled').pages.featured.title,
                className: 'nav-item-featured',
            });
        }

        if (PageStore.get('config-enabled').pages.recommended && PageStore.get('config-enabled').pages.recommended.enabled) {
            items.push({
                link: links.recommended,
                icon: 'done_outline',
                text: PageStore.get('config-enabled').pages.recommended.title,
                className: 'nav-item-recommended',
            });
        }

        if (PageStore.get('config-enabled').pages.latest && PageStore.get('config-enabled').pages.latest.enabled) {
            items.push({
                link: links.latest,
                icon: 'new_releases',
                text: PageStore.get('config-enabled').pages.latest.title,
                className: 'nav-item-latest',
            });
        }

        if (!sidebar.hideTagsLink && PageStore.get('config-enabled').taxonomies.tags && PageStore.get('config-enabled').taxonomies.tags.enabled) {
            items.push({
                link: links.archive.tags,
                icon: 'local_offer',
                text: PageStore.get('config-enabled').taxonomies.tags.title,
                className: 'nav-item-tags',
            });
        }

        if (PageStore.get('config-enabled').taxonomies.categories && PageStore.get('config-enabled').taxonomies.categories.enabled) {
            items.push({
                link: links.archive.categories,
                icon: 'list_alt',
                text: PageStore.get('config-enabled').taxonomies.categories.title,
                className: 'nav-item-categories',
            });
        }

        if (PageStore.get('config-enabled').taxonomies.topics && PageStore.get('config-enabled').taxonomies.topics.enabled) {
            items.push({
                link: links.archive.topics,
                icon: 'topic',
                text: PageStore.get('config-enabled').taxonomies.topics.title,
                className: 'nav-item-topics',
            });
        }

        if (PageStore.get('config-enabled').taxonomies.languages && PageStore.get('config-enabled').taxonomies.languages.enabled) {
            items.push({
                link: links.archive.languages,
                icon: 'language',
                text: PageStore.get('config-enabled').taxonomies.languages.title,
                className: 'nav-item-languages',
            });
        }

        if (PageStore.get('config-enabled').taxonomies.countries && PageStore.get('config-enabled').taxonomies.countries.enabled) {
            items.push({
                link: links.archive.countries,
                icon: 'public',
                text: PageStore.get('config-enabled').taxonomies.countries.title,
                className: 'nav-item-countries',
            });
        }

        if (PageStore.get('config-enabled').pages.members && PageStore.get('config-enabled').pages.members.enabled) {
            items.push({
                link: links.members,
                icon: 'people',
                text: PageStore.get('config-enabled').pages.members.title,
                className: 'nav-item-members',
            });
        }

        const extraItems = PageStore.get('config-contents').sidebar.mainMenuExtra.items;

        extraItems.forEach(navitem => {
            items.push({
                link: navitem.link,
                icon: navitem.icon,
                text: navitem.text,
                className: navitem.className,
            });
        });

        return items.length ? <NavigationMenuList key='main-first' items={formatItems(items)} /> : null;
    }

    function MainMenuSecondSection() {

        const items = [];

        if (!user.is.anonymous) {

            if (user.can.addMedia) {

                items.push({
                    link: links.user.addMedia,
                    icon: 'video_call',
                    text: "Upload media",
                    className: "nav-item-upload-media",
                });

                if (user.pages.home) {

                    items.push({
                        link: user.pages.home,
                        icon: 'video_library',
                        text: "My media",
                        className: "nav-item-my-media",
                    });
                }
            }

            if (user.can.saveMedia) {

                items.push({
                    link: user.pages.playlists,
                    icon: 'playlist_play',
                    text: "My playlists",
                    className: "nav-item-my-playlists",
                });
            }
        }

        return items.length ? <NavigationMenuList key='main-second' items={formatItems(items)} /> : null;
    }

    function UserMenuSection() {

        const items = [];

        if (PageStore.get('config-enabled').pages.history && PageStore.get('config-enabled').pages.history.enabled) {
            items.push({
                link: links.user.history,
                icon: 'history',
                text: PageStore.get('config-enabled').pages.history.title,
                className: "nav-item-history",
            });
        }

        if (user.can.likeMedia && PageStore.get('config-enabled').pages.liked && PageStore.get('config-enabled').pages.liked.enabled) {
            items.push({
                link: links.user.liked,
                icon: 'thumb_up',
                text: PageStore.get('config-enabled').pages.liked.title,
                className: "nav-item-liked",
            });
        }

        return items.length ? <NavigationMenuList key='user' items={formatItems(items)} /> : null;
    }

    function CustomMenuSection() {

        const items = PageStore.get('config-contents').sidebar.navMenu.items;

        return items.length ? <NavigationMenuList key='custom' items={formatItems(items)} /> : null;
    }

    function ExtraMenuSection() {

        const items = []

        items.push({
            link: '/help',
            icon: 'info',
            text: 'Help & Resources',
            className: 'nav-item-help',
        });
        items.push({
            link: 'https://support.cinemata.org',
            icon: 'monetization_on',
            text: 'Donate',
            className: 'nav-item-resources',
        });


        return <NavigationMenuList key='extra' items={formatItems(items)} />;
    }


    function AdminMenuSection() {

        const items = [];

        if (user.can.manageMedia) {
            items.push({
                link: links.manage.media,
                icon: 'miscellaneous_services',
                text: 'Manage videos',
                className: "nav-item-manage-media",
            });
        }

        if (user.can.manageUsers) {
            items.push({
                link: links.manage.users,
                icon: 'miscellaneous_services',
                text: 'Manage users',
                className: 'nav-item-manage-users',
            });
        }

        if (user.can.manageComments) {
            items.push({
                link: links.manage.comments,
                icon: 'miscellaneous_services',
                text: 'Manage comments',
                className: 'nav-item-manage-comments',
            });
        }

        return items.length ? <NavigationMenuList key='admin' items={formatItems(items)} /> : null;
    }

    return ([MainMenuFirstSection(), MainMenuSecondSection(), UserMenuSection(), CustomMenuSection(), ExtraMenuSection(), AdminMenuSection()]);
}
