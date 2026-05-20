import { useEffect, useState } from 'react';

function isHomePath() {
	if (typeof window === 'undefined') return false;
	const path = window.location.pathname;
	return path === '/' || path === '';
}

export function useIsHomeRoute() {
	const [home, setHome] = useState(isHomePath);

	useEffect(() => {
		function sync() {
			setHome(isHomePath());
		}
		window.addEventListener('popstate', sync);
		return () => window.removeEventListener('popstate', sync);
	}, []);

	return home;
}
