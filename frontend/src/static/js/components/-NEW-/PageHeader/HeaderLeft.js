import React, { useState, useEffect } from 'react';

import { Logo } from './Logo.js';

import PageStore from '../../../pages/_PageStore.js';

import LayoutStore from '../../../stores/LayoutStore.js';
import * as LayoutActions from '../../../actions/LayoutActions.js';

import { CircleIconButton } from '../CircleIconButton';

import { LinksConsumer } from '../../../contexts/LinksContext';
import { SiteConsumer } from '../../../contexts/SiteContext';

import ThemeStore from '../../../stores/ThemeStore';

export function HeaderLeft() {
	const [logo, setLogo] = useState(ThemeStore.get('logo'));

	function onClickCloseMobileSearch() {
		LayoutActions.changeMobileSearchVisibility(false);
	}

	function onThemeModeChange() {
		setLogo(ThemeStore.get('logo'));
	}

	useEffect(() => {
		ThemeStore.on('mode-change', onThemeModeChange);
		return () => ThemeStore.removeListener('mode-change', onThemeModeChange);
	}, []);

	return (
		<SiteConsumer>
			{(site) => (
				<LinksConsumer>
					{(links) => (
						<div className="page-header-left">
							<div>
								<div className="close-search-field">
									<CircleIconButton onClick={onClickCloseMobileSearch}>
										<i className="material-icons">arrow_back</i>
									</CircleIconButton>
								</div>
								{LayoutStore.get('enabled-sidebar') ? (
									<div className="toggle-sidebar">
										<CircleIconButton onClick={LayoutActions.toggleSidebar}>
											<i className="material-icons">menu</i>
										</CircleIconButton>
									</div>
								) : null}
								<Logo src={logo} href={links.home} title={site.title} />
								{PageStore.get('config-contents').header.onLogoRight ? (
									<div
										className="on-logo-right"
										dangerouslySetInnerHTML={{
											__html: PageStore.get('config-contents').header.onLogoRight,
										}}
									></div>
								) : null}
							</div>
						</div>
					)}
				</LinksConsumer>
			)}
		</SiteConsumer>
	);
}
