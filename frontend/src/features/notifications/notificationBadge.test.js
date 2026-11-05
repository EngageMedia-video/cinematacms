import { describe, expect, it } from 'vitest';

import { getBadgeForType } from './notificationBadge';

describe('getBadgeForType', () => {
	it('gives a Community Impact notification a badge', () => {
		expect(getBadgeForType('community_impact')).not.toBeNull();
	});

	it('gives an unknown notification type no badge', () => {
		expect(getBadgeForType('unknown_type')).toBeNull();
	});
});
