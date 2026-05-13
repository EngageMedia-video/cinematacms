import React from 'react';

// Legacy pages don't load AppLayout, so these globals must reload here.
import '../../../static/css/styles.scss';
import '../../../static/js/components/styles/PageMain.scss';

import { TopMessageHost } from '../components/TopMessageHost';
import { Topbar } from './Topbar';

export function LegacyTopbarMount() {
	return (
		<>
			<TopMessageHost />
			<Topbar />
		</>
	);
}
