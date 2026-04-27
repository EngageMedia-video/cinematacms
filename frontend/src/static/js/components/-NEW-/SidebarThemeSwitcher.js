import React, { useContext } from 'react';

import ThemeContext from '../../contexts/ThemeContext';
import { useThemeSwitcher } from './hooks/useThemeSwitcher';

export function SidebarThemeSwitcher() {
	const theme = useContext(ThemeContext);

	const [mode, toggleMode] = useThemeSwitcher();

	return theme.switch.enabled && 'sidebar' === theme.switch.position ? (
		<div className="sidebar-theme-switcher">
			<div className="sidebar-theme-switcher-inner">
				<span className={'theme-icon' + ('dark' === mode ? '' : ' active')}>
					<i className="material-icons" data-icon="wb_sunny"></i>
				</span>
				<span>
					<span className="checkbox-switcher">
						<input type="checkbox" checked={'dark' === mode} onChange={toggleMode} />
					</span>
				</span>
				<span className={'theme-icon' + ('dark' === mode ? ' active' : '')}>
					<i className="material-icons" data-icon="brightness_3"></i>
				</span>
			</div>
		</div>
	) : null;
}
