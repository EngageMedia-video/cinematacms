import { describe, expect, it } from 'vitest';
import { canDeleteComment } from './commentPermissions';

const member = (anonymous, deleteComment) => ({
	is: { anonymous },
	can: { deleteComment },
});

describe('canDeleteComment', () => {
	it('allows the comment the API marked deletable for this viewer', () => {
		expect(canDeleteComment(member(false, false), { can_delete: true })).toBe(true);
	});

	it('refuses a comment the API marked not deletable', () => {
		expect(canDeleteComment(member(false, true), { can_delete: false })).toBe(false);
	});

	it('falls back to the page-wide permission when the comment carries no flag', () => {
		expect(canDeleteComment(member(false, true), {})).toBe(true);
		expect(canDeleteComment(member(false, false), {})).toBe(false);
	});

	it('refuses a signed-out visitor', () => {
		expect(canDeleteComment(member(true, true), { can_delete: true })).toBe(false);
	});
});
