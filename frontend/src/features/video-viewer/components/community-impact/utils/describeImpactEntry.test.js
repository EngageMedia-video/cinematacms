import { describe, expect, it } from 'vitest';
import { describeImpactEntry } from './describeImpactEntry';

describe('describeImpactEntry', () => {
	it('describes an in-person screening by place and organiser', () => {
		expect(
			describeImpactEntry({
				category: 'screening',
				city: 'Hanoi',
				country_label: 'Viet Nam',
				organiser: 'Youth Media Collective',
			})
		).toBe('Hanoi, Viet Nam · Organised by Youth Media Collective');
	});

	it('describes an online screening without a place and skips a hidden organiser', () => {
		expect(describeImpactEntry({ category: 'screening', is_online: true, organiser: '' })).toBe('Online');
	});

	it('describes articles, referencing works, awards, and teaching', () => {
		expect(describeImpactEntry({ category: 'article', creator: 'Dewi Lestari', publication: 'Jakarta Post' })).toBe(
			'By Dewi Lestari · Jakarta Post'
		);
		expect(
			describeImpactEntry({ category: 'referenced', medium_label: 'Performance', creator: 'Pacific Arts' })
		).toBe('Performance · Made by Pacific Arts');
		expect(describeImpactEntry({ category: 'award', award_result_label: 'Won', organiser: 'Busan IFF' })).toBe(
			'Won · Given by Busan IFF'
		);
		expect(describeImpactEntry({ category: 'teaching', creator: 'Dr. Santos', organiser: 'UP Diliman' })).toBe(
			'Led by Dr. Santos · UP Diliman'
		);
	});

	it('returns an empty summary for legacy entries', () => {
		expect(describeImpactEntry({ category: 'featured', title: 'Regional roundup' })).toBe('');
		expect(describeImpactEntry()).toBe('');
	});
});
