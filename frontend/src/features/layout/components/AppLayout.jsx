import React from 'react';

import { PageHeader } from '../../../static/js/components/-NEW-/PageHeader';
import { PageSidebar } from '../../../static/js/components/-NEW-/PageSidebar';
import { PageSidebarContentOverlay } from '../../../static/js/components/-NEW-/PageSidebarContentOverlay';
import { RippleDecoration } from './RippleDecoration';

import './AppLayout.scss';

export function AppLayout({ ContentComponent, pageSlotId }) {
	const PageContent = ContentComponent || null;

	return (
		<div className="app-layout" data-modern-shell="page">
			<div className="app-layout__ripple-anchor">
				<RippleDecoration />
			</div>

			<PageHeader />
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
