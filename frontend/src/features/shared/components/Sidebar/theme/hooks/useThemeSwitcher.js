/* eslint-disable no-restricted-imports */
import { useState, useEffect } from 'react';

import ThemeStore from '../../../../../../static/js/stores/ThemeStore.js';
import * as ThemeActions from '../../../../../../static/js/actions/ThemeActions.js';

export function useThemeSwitcher() {
	const [mode, setMode] = useState(ThemeStore.get('mode'));

	function onThemeModeChange() {
		setMode(ThemeStore.get('mode'));
	}

	function toggleMode() {
		ThemeActions.toggleMode();
	}

	useEffect(() => {
		ThemeStore.on('mode-change', onThemeModeChange);
		return () => ThemeStore.removeListener('mode-change', onThemeModeChange);
	}, []);

	return [mode, toggleMode];
}
