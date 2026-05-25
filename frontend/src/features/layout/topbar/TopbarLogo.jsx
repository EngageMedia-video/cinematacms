import React, { useContext } from 'react';

import LinksContext from '../../../static/js/contexts/LinksContext';
import SiteContext from '../../../static/js/contexts/SiteContext';
import { useThemeLogo } from './useThemeLogo';

// Logo files are operator-configurable via templates/config/installation/site.html
// (logo.desktop / logo.mobile). On a fresh public repo both URLs point at the
// bundled placeholder SVGs in /static/images/, so the deployment stays
// white-label until an operator swaps in their own logo.
export function TopbarLogo() {
	const links = useContext(LinksContext);
	const site = useContext(SiteContext);
	const desktopLogo = useThemeLogo('desktop');
	const mobileLogo = useThemeLogo('mobile');

	if (!desktopLogo && !mobileLogo) return null;

	const homeHref = links?.home || '/';
	const title = site?.title || 'Home';

	return (
		<a
			href={homeHref}
			title={title}
			aria-label={title}
			className="inline-flex items-center shrink-0 no-underline text-cinemata-white"
		>
			{mobileLogo ? (
				<img src={mobileLogo} alt={title} className="block h-8 w-auto sm:hidden" loading="eager" />
			) : null}
			{desktopLogo ? (
				<img src={desktopLogo} alt={title} className="hidden h-9 w-auto sm:block" loading="eager" />
			) : null}
		</a>
	);
}
