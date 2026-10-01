import { renderPage } from '../static/js/_helpers';
import { CreatorAnalyticsPage } from '../features/creator-analytics/CreatorAnalyticsPage';

const data = JSON.parse(document.getElementById('creator-analytics-data').textContent);

function CreatorAnalyticsEntry() {
	return <CreatorAnalyticsPage data={data} />;
}

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const url = new URL(window.location.href);
if (browserTimezone && data.timezone !== browserTimezone && url.searchParams.get('tz') !== browserTimezone) {
	url.searchParams.set('tz', browserTimezone);
	window.location.replace(url.href);
} else {
	renderPage('page-creator-analytics', CreatorAnalyticsEntry);
}
