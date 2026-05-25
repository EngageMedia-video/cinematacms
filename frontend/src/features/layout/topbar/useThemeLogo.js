import { useEffect, useState } from 'react';

// Logo URL comes from the legacy Flux ThemeStore (resolved from
// site.html's logo + logo.mobile JSON config). The store stays the
// single source of truth — duplicating it into a Zustand store would
// force two writers of the same value.
/* eslint-disable no-restricted-imports */
import ThemeStore from '../../../static/js/stores/ThemeStore';
/* eslint-enable no-restricted-imports */

export function useThemeLogo(variant = 'desktop') {
	const key = variant === 'mobile' ? 'logo-mobile' : 'logo';
	const [url, setUrl] = useState(() => ThemeStore.get(key));

	useEffect(() => {
		function onChange() {
			setUrl(ThemeStore.get(key));
		}
		ThemeStore.on('mode-change', onChange);
		return () => ThemeStore.removeListener('mode-change', onChange);
	}, [key]);

	return url;
}
