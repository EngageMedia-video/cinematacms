/* eslint-disable no-restricted-imports */
import React, { useState, useEffect } from 'react';

import { SidebarNavigationMenu } from '../navigation/SidebarNavigationMenu';
import { SidebarThemeSwitcher } from '../theme/SidebarThemeSwitcher';

import PageStore from '../../../../static/js/pages/_PageStore.js';
import LayoutStore from '../../../../static/js/stores/LayoutStore.js';
import { Icon } from '../../../shared/components/Icon/Icon.jsx';
import { Link } from '../../../shared/components/Link/Link.jsx';
import { cn } from '../../../shared/utils/classNames.js';

function SidebarRippleDecoration({ className }) {
	return (
		<div
			className={cn(
				'pointer-events-none absolute bottom-0 right-0 z-0 h-[175px] w-[168px] overflow-hidden',
				className
			)}
			aria-hidden="true"
		>
			<img
				src="/static/images/img_ripple_sidebar_light.webp"
				alt=""
				className="absolute bottom-0 right-0 block h-[175px] w-[168px] max-w-none object-contain dark:hidden"
			/>
			<img
				src="/static/images/img_ripple_sidebar_dark.webp"
				alt=""
				className="absolute bottom-0 right-0 hidden h-[175px] w-[168px] max-w-none object-contain dark:block"
			/>
		</div>
	);
}

function SidebarSocialLink({ link, icon, label, target = '_blank', rel = 'noreferrer' }) {
	return (
		<Link
			href={link}
			target={target}
			rel={rel}
			aria-label={label}
			title={label}
			className={cn(
				'inline-flex size-9 items-center justify-center rounded-full border no-underline transition-colors duration-200',
				'border-cinemata-strait-blue-300 text-cinemata-strait-blue-400 hover:border-cinemata-strait-blue-500 hover:text-cinemata-strait-blue-600',
				'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cinemata-strait-blue-500',
				'dark:border-cinemata-strait-blue-300/40 dark:text-cinemata-strait-blue-300 dark:hover:border-cinemata-strait-blue-300 dark:hover:text-cinemata-white'
			)}
		>
			<Icon name={icon} size={18} decorative className="[&_path]:fill-current" />
		</Link>
	);
}

export function Sidebar({ id = 'app-sidebar' }) {
	const [isMobileViewport, setIsMobileViewport] = useState(window.innerWidth < 768);
	const [isVisible, setIsVisible] = useState(LayoutStore.get('visible-sidebar'));
	const [isRendered, setIsRendered] = useState(
		LayoutStore.get('visible-sidebar') || 492 > PageStore.get('window-inner-width')
	);

	const sidebarContents = PageStore.get('config-contents').sidebar;
	const footerNew = sidebarContents.footerNew || {};
	const footerLogo = footerNew.logo;
	const footerLinks = footerNew.links || [];
	const socialLinks = sidebarContents.socialLinks || [];
	const shouldRenderSidebarContent = isVisible || isRendered;

	const sidebarWidth = isMobileViewport ? '100vw' : 'var(--sidebar-width)';
	const hiddenTransform = isMobileViewport
		? 'translate(-100vw, 0px)'
		: 'translate(calc(-1 * var(--sidebar-width)), 0px)';

	const sidebarFooterContent = shouldRenderSidebarContent ? (
		<div className="relative z-10 flex flex-col gap-4 py-4 px-4">
			<div>
				{/* TODO: Place storage component here */}
				<p>Placeholder for storage</p>
			</div>

			<Link
				variant="tertiary"
				href="https://support.cinemata.org"
				target="_blank"
				align="left"
				icon={<Icon name="donate" />}
				style={{ width: '208px' }}
			>
				DONATE
			</Link>

			<SidebarThemeSwitcher />

			{footerLogo || footerLinks.length ? (
				<div className="flex flex-col gap-2">
					{footerLogo ? (
						<a
							href={footerLogo.link}
							target={footerLogo.target || '_blank'}
							rel={footerLogo.rel || 'noreferrer'}
							title={footerLogo.title}
						>
							<span>
								<img src={footerLogo.darkImage} alt="" className="dark:hidden block h-4" />
								<img src={footerLogo.lightImage} alt="" className="hidden dark:block h-4" />
							</span>
						</a>
					) : null}

					{footerLinks.map((item) => (
						<Link
							key={item.link}
							href={item.link}
							target={item.target || '_blank'}
							rel={item.rel || 'noreferrer'}
							className="body-body-12-regular hover:opacity-90 text-cinemata-pacific-deep-400 dark:text-cinemata-strait-blue-300"
						>
							{item.text}
						</Link>
					))}
				</div>
			) : null}
		</div>
	) : null;

	function onVisibilityChange() {
		setIsRendered(true);
		setIsVisible(LayoutStore.get('visible-sidebar'));
	}

	useEffect(() => {
		function onResize() {
			setIsMobileViewport(window.innerWidth < 768);
		}

		LayoutStore.on('sidebar-visibility-change', onVisibilityChange);
		window.addEventListener('resize', onResize);

		return () => {
			LayoutStore.removeListener('sidebar-visibility-change', onVisibilityChange);
			window.removeEventListener('resize', onResize);
		};
	}, []);

	return (
		<aside
			id={id || undefined}
			className="fixed bottom-0 left-0 isolate flex flex-col overflow-hidden overscroll-none bg-bg-surface"
			style={{
				transform: isVisible ? 'translate(0px, 0px)' : hiddenTransform,
				transitionDuration: '0.2s',
				transitionProperty: 'transform',
				top: 'calc(var(--header-height) + var(--top-message-height, 0px))',
				width: sidebarWidth,
				zIndex: isMobileViewport ? 6 : 5,
			}}
		>
			{isMobileViewport ? <SidebarRippleDecoration /> : null}

			<div
				className={cn(
					'relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]',
					'[scrollbar-width:thin] [scrollbar-color:var(--cinemata-strait-blue-200)_transparent]',
					'[&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent',
					'[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2',
					'[&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--cinemata-strait-blue-200)]',
					'[&::-webkit-scrollbar-thumb]:bg-clip-content'
				)}
			>
				<div className="relative min-h-full pb-16 md:pb-0">
					{isMobileViewport ? null : <SidebarRippleDecoration />}

					<div className="relative z-10 space-y-4">
						{shouldRenderSidebarContent ? <SidebarNavigationMenu /> : null}
						{shouldRenderSidebarContent && socialLinks.length ? (
							<ul className="relative m-0 flex w-full list-none items-center justify-center gap-8 border-y border-sidebar-nav-border px-8 py-4">
								{socialLinks.map((item) => (
									<li key={item.link}>
										<SidebarSocialLink {...item} />
									</li>
								))}
							</ul>
						) : null}
						{isMobileViewport ? null : sidebarFooterContent}
					</div>
				</div>
			</div>

			{isMobileViewport ? sidebarFooterContent : null}
		</aside>
	);
}
