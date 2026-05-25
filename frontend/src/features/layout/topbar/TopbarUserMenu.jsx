import React, { useContext, useEffect, useRef } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import UserContext from '../../../static/js/contexts/UserContext';
import HeaderContext from '../../../static/js/contexts/HeaderContext';
import { useThemeSwitcher } from '../../../static/js/components/-NEW-/hooks/useThemeSwitcher.js';
import { Avatar } from '../../shared/components/Avatar';
import { Text } from '../../shared/components/Text';
import { cn } from '../../shared/utils/classNames';
import useTopbarStore from './useTopbarStore';

function isSignOut(item) {
	const link = (item?.link || '').toLowerCase();
	const text = (item?.text || '').toLowerCase();
	return link.includes('signout') || link.includes('logout') || text.includes('sign out') || text.includes('log out');
}

function ThemeSwitcherMenuItem() {
	const [mode, toggleMode] = useThemeSwitcher();
	const isDark = mode === 'dark';
	return (
		<button
			type="button"
			onClick={toggleMode}
			role="menuitemcheckbox"
			aria-checked={isDark}
			className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-strong transition-colors duration-150 bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
		>
			<i aria-hidden="true" className="material-icons shrink-0 text-text-strong" style={{ fontSize: 20 }}>
				{isDark ? 'brightness_3' : 'wb_sunny'}
			</i>
			<span className="flex-1 text-left truncate">{isDark ? 'Light mode' : 'Dark mode'}</span>
		</button>
	);
}

function ThemeSwitcherInlineButton() {
	const [mode, toggleMode] = useThemeSwitcher();
	const isDark = mode === 'dark';
	return (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			aria-pressed={isDark}
			className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-bg-chrome hover:bg-bg-chrome-hover transition-colors shrink-0 text-text-on-chrome"
		>
			<i aria-hidden="true" className="material-icons" style={{ fontSize: 20 }}>
				{isDark ? 'brightness_3' : 'wb_sunny'}
			</i>
		</button>
	);
}

function MenuItem({ item }) {
	if (!item) return null;
	const signOut = isSignOut(item);

	const base =
		'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-text-strong transition-colors duration-150 no-underline';
	const hover = signOut
		? 'hover:bg-cinemata-sunset-horizon-500/10 hover:text-cinemata-sunset-horizon-500'
		: 'hover:bg-black/[0.04] dark:hover:bg-white/[0.04]';
	const iconClass = signOut ? 'text-cinemata-sunset-horizon-300' : 'text-text-strong';

	return (
		<a href={item.link || '#'} className={cn(base, hover)}>
			{item.icon ? (
				<i aria-hidden="true" className={cn('material-icons shrink-0', iconClass)} style={{ fontSize: 20 }}>
					{item.icon}
				</i>
			) : (
				<span aria-hidden="true" className="w-5 shrink-0" />
			)}
			<span className="truncate">{item.text}</span>
		</a>
	);
}

export function TopbarUserMenu() {
	const user = useContext(UserContext);
	const links = useContext(LinksContext);
	const header = useContext(HeaderContext);

	const isOpen = useTopbarStore((state) => state.isUserMenuOpen);
	const toggle = useTopbarStore((state) => state.toggleUserMenu);
	const close = useTopbarStore((state) => state.closeUserMenu);

	const wrapperRef = useRef(null);

	useEffect(() => {
		if (!isOpen) return;
		function onDocMouseDown(event) {
			if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				close();
			}
		}
		function onEsc(event) {
			if (event.key === 'Escape') close();
		}
		document.addEventListener('mousedown', onDocMouseDown);
		document.addEventListener('keydown', onEsc);
		return () => {
			document.removeEventListener('mousedown', onDocMouseDown);
			document.removeEventListener('keydown', onEsc);
		};
	}, [isOpen, close]);

	if (!user) return null;

	if (user.is?.anonymous) {
		const canLogin = Boolean(user.can?.login);
		const canRegister = Boolean(user.can?.register);
		const showThemeSwitcher = Boolean(header?.hasThemeSwitcher);
		if (!canLogin && !canRegister && !showThemeSwitcher) return null;
		return (
			<div className="inline-flex items-center gap-2 shrink-0">
				{showThemeSwitcher ? <ThemeSwitcherInlineButton /> : null}
				{canRegister ? (
					<a
						href={links?.register || '/accounts/signup/'}
						className="hidden sm:inline-flex items-center justify-center rounded h-10 px-3 text-sm font-bold uppercase tracking-wide transition-all shrink-0 no-underline border border-white/15 hover:bg-white/[0.04] text-text-on-chrome"
					>
						Register
					</a>
				) : null}
				{canLogin ? (
					<a
						href={links?.signin || '/accounts/login/'}
						className="inline-flex items-center justify-center rounded h-10 px-4 text-sm font-bold uppercase tracking-wide transition-all shrink-0 no-underline bg-brand-primary text-btn-text hover:bg-brand-primary-hover"
					>
						Sign in
					</a>
				) : null}
			</div>
		);
	}

	// Legacy 'open-subpage' items (e.g. "Switch theme") relied on the old popup's
	// nested page mechanism, which the new flat menu does not implement.
	// Filter them so we don't render dead-click entries; revisit when subpage UX returns.
	const allItems = [
		...(header?.popupNavItems?.top || []),
		...(header?.popupNavItems?.middle || []),
		...(header?.popupNavItems?.bottom || []),
	].filter((item) => item?.itemType !== 'open-subpage');
	const signOutItems = allItems.filter(isSignOut);
	const primaryItems = allItems.filter((item) => !isSignOut(item));

	return (
		<div ref={wrapperRef} className="relative inline-flex items-center shrink-0">
			<button
				type="button"
				onClick={toggle}
				aria-label={`User menu${user.username ? ` for ${user.username}` : ''}`}
				aria-haspopup="true"
				aria-expanded={isOpen}
				className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring-focus"
				style={{ width: 40, height: 40 }}
			>
				<Avatar
					src={user.thumbnail}
					name={user.username || user.name || 'User'}
					size="large"
					style={{ width: 40, height: 40 }}
				/>
			</button>
			{isOpen ? (
				<div
					role="menu"
					className="absolute right-0 top-full mt-3 w-[240px] overflow-hidden rounded-xl bg-bg-surface-raised ring-1 ring-border-subtle shadow-2xl z-50"
				>
					{user.username ? (
						<a
							href={user.pages?.about || '#'}
							className="flex items-center gap-3 px-4 py-3.5 bg-bg-surface hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors no-underline border-b border-border-subtle"
						>
							<Avatar
								src={user.thumbnail}
								name={user.username}
								size="large"
								style={{ width: 36, height: 36 }}
							/>
							<div className="min-w-0 flex-1">
								<div className="text-sm font-semibold text-text-strong truncate">{user.username}</div>
								<Text as="div" variant="body-12" className="m-0 mt-0.5 truncate text-text-muted">
									View profile
								</Text>
							</div>
						</a>
					) : null}
					<div className="py-1.5">
						{primaryItems.map((item, idx) => (
							<MenuItem key={`item-${idx}`} item={item} />
						))}
						{header?.hasThemeSwitcher ? <ThemeSwitcherMenuItem /> : null}
					</div>
					{signOutItems.length > 0 ? (
						<>
							<div className="h-px bg-border-subtle" aria-hidden="true" />
							<div className="py-1.5">
								{signOutItems.map((item, idx) => (
									<MenuItem key={`signout-${idx}`} item={item} />
								))}
							</div>
						</>
					) : null}
				</div>
			) : null}
		</div>
	);
}
