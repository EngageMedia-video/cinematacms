import React, { useContext } from 'react';

import ThemeContext from '../../../../../static/js/contexts/ThemeContext';
import { useThemeSwitcher } from './hooks/useThemeSwitcher';
import { SegmentButton } from '../../SegmentButton/SegmentButton';

export function SidebarThemeSwitcher() {
	const theme = useContext(ThemeContext);

	const [mode, toggleMode] = useThemeSwitcher();

	return theme.switch.enabled && 'sidebar' === theme.switch.position ? (
		<SegmentButton
			options={[
				{
					iconName: 'moon',
					label: 'Dark',
					value: 'dark',
				},
				{
					iconName: 'sun',
					label: 'Light',
					value: 'light',
				},
			]}
			layout="fill"
			defaultValue={mode}
			onValueChange={toggleMode}
		/>
	) : null;
}
