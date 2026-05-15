import React, { useContext, useEffect, useRef } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import UserContext from '../../../static/js/contexts/UserContext';
import HeaderContext from '../../../static/js/contexts/HeaderContext';
import { Avatar } from '../../shared/components/Avatar';
import { cn } from '../../shared/utils/classNames';
import useTopbarStore from './useTopbarStore';

function isSignOut(item) {
	const link = (item?.link || '').toLowerCase();
	const text = (item?.text || '').toLowerCase();
	return link.includes('signout') || link.includes('logout') || text.includes('sign out') || text.includes('log out');
}

function MenuItem({ item }) {
	if (!item) return null;
	const signOut = isSignOut(item);

	const base =
		'flex w-full items-center gap-3 px-4 py-2.5 text-sm text-cinemata-strait-blue-50 transition-colors duration-150 no-underline';
	const hover = signOut
		? 'hover:bg-cinemata-sunset-horizon-500/10 hover:text-cinemata-sunset-horizon-500'
		: 'hover:bg-white/[0.04] hover:text-cinemata-white';
	const iconStyle = signOut ? { color: '#F08A4B' } : { color: '#DEFBFF' };

	return (
		<a href={item.link || '#'} className={cn(base, hover)}>
			{item.icon ? (
				<i aria-hidden="true" className="material-icons shrink-0" style={{ fontSize: 20, ...iconStyle }}>
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
		return (
			<a
				href={links?.signin || '/accounts/login/'}
				style={{ backgroundColor: '#C2692F', color: '#F9FAFB' }}
				className="inline-flex items-center justify-center rounded h-10 px-4 hover:brightness-110 text-sm font-bold uppercase tracking-wide transition-all shrink-0 no-underline"
			>
				Sign in
			</a>
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
				className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 transition-shadow hover:ring-2 hover:ring-white/20"
				style={{ width: 40, height: 40, boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}
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
					className="absolute right-0 top-full mt-3 w-[240px] overflow-hidden rounded-xl bg-cinemata-pacific-deep-800 ring-1 ring-white/10 shadow-2xl z-50"
					style={{ boxShadow: '0 24px 48px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' }}
				>
					{user.username ? (
						<a
							href={user.pages?.about || '#'}
							className="flex items-center gap-3 px-4 py-3.5 bg-black/20 hover:bg-black/30 transition-colors no-underline border-b border-white/5"
						>
							<Avatar
								src={user.thumbnail}
								name={user.username}
								size="large"
								style={{ width: 36, height: 36 }}
							/>
							<div className="min-w-0 flex-1">
								<div className="text-sm font-semibold text-cinemata-white truncate">
									{user.username}
								</div>
								<div className="text-xs truncate mt-0.5" style={{ color: '#7B98B6' }}>
									View profile
								</div>
							</div>
						</a>
					) : null}
					<div className="py-1.5">
						{primaryItems.map((item, idx) => (
							<MenuItem key={`item-${idx}`} item={item} />
						))}
					</div>
					{signOutItems.length > 0 ? (
						<>
							<div className="h-px bg-white/5" aria-hidden="true" />
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
