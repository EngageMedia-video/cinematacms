import React, { useContext, useEffect, useState } from 'react';
import BrowserCache from '../../classes/BrowserCache.js';
import SiteContext from '../../contexts/SiteContext';
import { CircleIconButton } from './CircleIconButton';

import '../styles/VisitorPopup.scss';

export function VisitorPopup() {
	const site = useContext(SiteContext);
	const [browserCache, setBrowserCache] = useState(null);
	const [isOpen, setIsOpen] = useState(false);

	const closePopup = () => setIsOpen(false);

	useEffect(() => {
		if (browserCache) {
			const now = new Date().getTime();
			const lastViewed = browserCache.get('lead-curator');
			// const lastViewedPlusDay = lastViewed + (60 * 60 * 24 * 1000);

			// if(! lastViewed || now > lastViewed ){
			if (!lastViewed) {
				browserCache.set('lead-curator', now);
				setIsOpen(true);
			}
		}
	}, [browserCache]);

	useEffect(() => {
		setBrowserCache(new BrowserCache('MediaCMS[' + site.id + '][modal]', 86400)); // Keep in cache for 1 day.
	}, []);

	return !isOpen ? null : (
		<>
			<div className="visitor-popup">
				<div className="visitor-popup-inner">
					<div className="visitor-popup-main">
						<div className="visitor-popup-content">
							<CircleIconButton onClick={closePopup}>
								<i className="material-icons" data-icon="close"></i>
							</CircleIconButton>
							<a href="//engagemedia.org/2021/job-cinemata-lead-curator/" target="_blank" title="">
								<img src="./static/images/Cinemata-Lead-Curator_Landscape-1024x576.png" alt="" />
							</a>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
