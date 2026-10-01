import { renderPage } from '../static/js/_helpers';
import { CreatorAnalyticsPage } from '../features/creator-analytics/CreatorAnalyticsPage';

const data = JSON.parse(document.getElementById('creator-analytics-data').textContent);

function CreatorAnalyticsEntry() {
	return <CreatorAnalyticsPage data={data} />;
}

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (browserTimezone && data.timezone !== browserTimezone) {
	const url = new URL(window.location.href);
	url.searchParams.set('tz', browserTimezone);
	window.location.replace(url.href);
} else {
	renderPage('page-creator-analytics', CreatorAnalyticsEntry);
}
