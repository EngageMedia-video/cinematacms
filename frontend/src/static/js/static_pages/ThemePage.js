import React, { useEffect } from 'react';

import { Page } from './_StaticPage';
import * as PageActions from './_StaticPageActions';

import { ThemeAlerts, ThemeButtons, ThemeTypography, ThemeFormControls } from '../theme_components/';

export function ThemePage() {
	useEffect(() => {
		PageActions.initPage('theme');
	}, []);

	return (
		<Page>
			<div className="custom-page-wrapper">
				{/*<ThemeButtons />*/} {/* Not ready yet */}
				<ThemeTypography />
				<ThemeFormControls />
				<ThemeAlerts />
			</div>
		</Page>
	);
}
