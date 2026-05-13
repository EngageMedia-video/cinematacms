import React from 'react';

// Required global resets; do not remove.
import '../../../static/css/styles.scss';
import '../../../static/js/components/styles/PageMain.scss';

import { PageSidebar } from '../../../static/js/components/-NEW-/PageSidebar';
import { PageSidebarContentOverlay } from '../../../static/js/components/-NEW-/PageSidebarContentOverlay';
import { RippleDecoration } from './RippleDecoration';
import { TopMessageHost } from './TopMessageHost';
import { Topbar } from '../topbar';

import './AppLayout.scss';

export function AppLayout({ ContentComponent, pageSlotId }) {
	const PageContent = ContentComponent || null;

	return (
		<div className="app-layout" data-modern-shell="page">
			<div className="app-layout__ripple-anchor">
				<RippleDecoration />
			</div>

			<TopMessageHost />
			<Topbar />
			<PageSidebar />

			<main className="page-main">
				<div className="page-main-inner app-layout__content">
					{pageSlotId ? (
						<div id={pageSlotId} className="app-layout__slot" data-modern-track>
							{PageContent ? <PageContent /> : null}
						</div>
					) : PageContent ? (
						<div className="app-layout__slot" data-modern-track>
							<PageContent />
						</div>
					) : null}
				</div>

				<PageSidebarContentOverlay />
			</main>
		</div>
	);
}
