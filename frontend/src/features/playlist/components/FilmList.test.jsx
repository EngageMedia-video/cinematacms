import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sortable from 'sortablejs';
import { FilmList } from './FilmList';

const move = vi.fn();

vi.mock('sortablejs', () => ({
	default: { create: vi.fn(() => ({ destroy: vi.fn() })) },
}));

vi.mock('../hooks/usePlaylistMediaMutations', () => ({
	useMovePlaylistMediaMutation: () => ({ move }),
	useRemovePlaylistMediaMutation: () => ({ mutate: vi.fn() }),
}));

const media = ['a', 'b', 'c'].map((token) => ({
	friendly_token: token,
	title: `Film ${token}`,
	url: `/view?m=${token}`,
	views: 1,
}));

function tokensOf(list) {
	return [...list.children].map((item) => item.dataset.mediaToken);
}

describe('FilmList drag reorder', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('reverts the SortableJS DOM move in onEnd so React stays the DOM owner', () => {
		render(<FilmList config={{}} isOwner media={media} onShare={() => {}} playlistToken="tok" />);

		const [list, options] = Sortable.create.mock.calls[0];
		expect(tokensOf(list)).toEqual(['a', 'b', 'c']);

		// Simulate SortableJS physically moving row 0 to the end on drop.
		const item = list.children[0];
		list.appendChild(item);
		expect(tokensOf(list)).toEqual(['b', 'c', 'a']);

		options.onEnd({ from: list, item, oldIndex: 0, newIndex: 2 });

		expect(tokensOf(list)).toEqual(['a', 'b', 'c']);
		expect(move).toHaveBeenCalledTimes(1);
		expect(move.mock.calls[0][1]).toBe(0);
		expect(move.mock.calls[0][2]).toBe(2);
	});

	it('ignores drops on the same position', () => {
		render(<FilmList config={{}} isOwner media={media} onShare={() => {}} playlistToken="tok" />);

		const [list, options] = Sortable.create.mock.calls[0];
		options.onEnd({ from: list, item: list.children[1], oldIndex: 1, newIndex: 1 });

		expect(move).not.toHaveBeenCalled();
	});
});
