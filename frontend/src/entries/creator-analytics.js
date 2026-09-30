import { renderPage } from '../static/js/_helpers';
import { CreatorAnalyticsPage } from '../features/creator-analytics/CreatorAnalyticsPage';

const data = JSON.parse(document.getElementById('creator-analytics-data').textContent);

function CreatorAnalyticsEntry() {
	return <CreatorAnalyticsPage data={data} />;
}

renderPage('page-creator-analytics', CreatorAnalyticsEntry);
