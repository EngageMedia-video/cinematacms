import { applyEditMediaPayloadFields } from './useSubmitEditMedia';

describe('applyEditMediaPayloadFields', () => {
	it('writes enabled visibility expiration dates into the edit payload', () => {
		const body = new FormData();

		applyEditMediaPayloadFields(body, {
			visibilityExpiration: {
				expireEnabled: true,
				startDate: '2026-07-10',
				endDate: '2026-07-20',
			},
		});

		expect(body.get('visibility_start')).toBe('2026-07-10');
		expect(body.get('visibility_end')).toBe('2026-07-20');
	});

	it('submits empty visibility fields when expiration is disabled so Django clears existing schedules', () => {
		const body = new FormData();
		body.set('visibility_start', '2026-07-10');
		body.set('visibility_end', '2026-07-20');

		applyEditMediaPayloadFields(body, {
			visibilityExpiration: {
				expireEnabled: false,
				startDate: '',
				endDate: '',
			},
		});

		expect(body.get('visibility_start')).toBe('');
		expect(body.get('visibility_end')).toBe('');
	});
});
