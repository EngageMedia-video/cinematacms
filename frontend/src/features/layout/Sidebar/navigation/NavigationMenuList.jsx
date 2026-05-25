import React from 'react';
import PropTypes from 'prop-types';

import { Icon } from '../../../shared/components/Icon';
import { getIconComponent } from '../../../shared/components/Icon/iconRegistry';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

const SIDEBAR_ICON_CLASS_ALIASES = {
	'nav-item-featured': 'featured',
	'nav-item-recommended': 'trending',
	'nav-item-latest': 'recentUploads',
	'nav-item-categories': 'categories',
	'nav-item-topics': 'topics',
	'nav-item-languages': 'languages',
	'nav-item-countries': 'countries',
	'nav-item-upload-media': 'uploadMedia',
	'nav-item-my-playlists': 'myPlaylists',
	'nav-item-history': 'clock',
	'nav-item-liked': 'thumbUp',
	'nav-item-about-us': 'aboutUs',
	'nav-item-editorial-policy': 'editorialPolicy',
	'nav-item-contact-us': 'contact',
	'nav-item-manage-media': 'manage',
	'nav-item-manage-users': 'manage',
	'nav-item-manage-comments': 'manage',
};

const SIDEBAR_ICON_NAME_ALIASES = {
	done_outline: 'trending',
	history: 'clock',
	language: 'languages',
	list_alt: 'categories',
	new_releases: 'recentUploads',
	playlist_play: 'myPlaylists',
	public: 'countries',
	star: 'featured',
	thumb_up: 'thumbUp',
	topic: 'topics',
	video_call: 'uploadMedia',
};

function resolveNavigationIconName(name, itemClassName = '') {
	const classNames = itemClassName.split(/\s+/).filter(Boolean);

	for (const className of classNames) {
		if (SIDEBAR_ICON_CLASS_ALIASES[className]) {
			return SIDEBAR_ICON_CLASS_ALIASES[className];
		}
	}

	return SIDEBAR_ICON_NAME_ALIASES[name] || name;
}

function NavigationItemIcon({ name, itemClassName }) {
	if (!name) {
		return null;
	}

	const resolvedName = resolveNavigationIconName(name, itemClassName);

	if (getIconComponent(resolvedName)) {
		return <Icon name={resolvedName} className={itemClassName} size={18} decorative />;
	}

	return <i className="material-icons" data-icon={name} aria-hidden="true"></i>;
}

NavigationItemIcon.propTypes = {
	name: PropTypes.string,
	itemClassName: PropTypes.string,
};

export function NavigationMenuListItem({
	itemType = 'link',
	link,
	icon,
	iconPos = 'left',
	text,
	active = false,
	divAttr,
	buttonAttr,
	itemAttr,
	linkAttr,
}) {
	let children = [];
	const attr = { ...(itemAttr || {}) };
	const baseClassName = attr.className || '';
	const isHovered = /\bis-hovered\b/.test(baseClassName);
	const isLabelItem = itemType === 'label';
	const interactiveClassName = joinClasses(
		'flex min-h-12 w-full items-center gap-3 rounded-[8px] border-0 px-4 py-3 text-left outline-none transition-colors duration-150',
		'bg-transparent text-[var(--sidebar-navigation-item-text-color)] no-underline',
		'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus',
		isLabelItem ? 'cursor-default font-medium' : 'cursor-pointer',
		isHovered && !active
			? 'bg-[var(--sidebar-navigation-item-hover-bg-color)] text-[var(--sidebar-navigation-item-hover-text-color)]'
			: '',
		active
			? 'bg-[var(--sidebar-navigation-item-active-bg-color)] text-[var(--sidebar-navigation-item-active-text-color)] font-medium'
			: '',
		!isLabelItem && !active
			? 'hover:bg-[var(--sidebar-navigation-item-hover-bg-color)] hover:text-[var(--sidebar-navigation-item-hover-text-color)] focus-visible:bg-[var(--sidebar-navigation-item-hover-bg-color)] focus-visible:text-[var(--sidebar-navigation-item-hover-text-color)]'
			: ''
	);

	let textPosIndex = text ? (!icon || iconPos === 'right' ? 0 : 1) : -1;
	let iconPosIndex = icon ? (text && iconPos === 'right' ? 1 : 0) : -1;

	if (-1 < textPosIndex) {
		children[textPosIndex] = (
			<span key="Text" className="body-body-14-regular min-w-0 flex-1 truncate leading-[1.45] text-current">
				{text}
			</span>
		);
	}

	if (-1 < iconPosIndex) {
		children[iconPosIndex] = (
			<span
				key="Icon"
				className={joinClasses(
					'inline-flex h-6 w-6 shrink-0 items-center justify-center',
					iconPos === 'right' ? 'ml-auto' : ''
				)}
			>
				<NavigationItemIcon
					name={icon}
					itemClassName={joinClasses(
						active
							? 'text-cinemata-sunset-horizon-400p'
							: 'text-cinemata dark:text-cinemata-strait-blue-200'
					)}
				/>
			</span>
		);
	}

	switch (itemType) {
		case 'link':
			const resolvedLinkAttr = { ...(linkAttr || {}) };

			if (active) {
				resolvedLinkAttr['aria-current'] = 'page';
			}

			children = (
				<a
					{...resolvedLinkAttr}
					href={link}
					title={text || null}
					className={joinClasses(
						'flex flex-row gap-4 mx-4 px-4 py-2 no-underline items-center rounded-ds-8 body-body-14-medium',
						'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus',
						active
							? 'bg-cinemata-strait-blue-800 text-cinemata-strait-blue-50'
							: 'bg-transparent hover:bg-cinemata-pacific-deep-50 dark:hover:bg-cinemata-strait-blue-900 text-text-secondary'
					)}
				>
					{children}
				</a>
			);

			break;
		case 'button':
		case 'open-subpage':
			children = (
				<button {...(buttonAttr || {})} key="button" className={interactiveClassName}>
					{children}
				</button>
			);
			break;
		case 'label':
			children = (
				<button {...(buttonAttr || {})} key="button" className={interactiveClassName}>
					<span>{text || null}</span>
				</button>
			);
			break;
		case 'div':
			children = (
				<div {...(divAttr || {})} key="div" className={interactiveClassName}>
					{text || null}
				</div>
			);
			break;
	}

	if ('' !== attr.className) {
		attr.className = ' ' + attr.className;
	}

	attr.className = attr.className.trim();

	return <li {...attr}>{children}</li>;
}

NavigationMenuListItem.propTypes = {
	itemType: PropTypes.oneOf(['link', 'open-subpage', 'button', 'label', 'div']),
	link: PropTypes.string,
	icon: PropTypes.string,
	iconPos: PropTypes.oneOf(['left', 'right']),
	text: PropTypes.string,
	active: PropTypes.bool,
	divAttr: PropTypes.object,
	buttonAttr: PropTypes.object,
	itemAttr: PropTypes.object,
	linkAttr: PropTypes.object,
};

export function NavigationMenuList({ removeVerticalPadding = false, items }) {
	const menuItems = items.map((item, index) => <NavigationMenuListItem key={index} itemType="label" {...item} />);

	return menuItems.length ? (
		<div className={joinClasses(removeVerticalPadding ? 'py-0' : 'py-3')}>
			<nav>
				<ul className="m-0 list-none p-0">{menuItems}</ul>
			</nav>
		</div>
	) : null;
}

NavigationMenuList.propTypes = {
	removeVerticalPadding: PropTypes.bool,
	items: PropTypes.arrayOf(PropTypes.shape(NavigationMenuListItem.propTypes)).isRequired,
};
