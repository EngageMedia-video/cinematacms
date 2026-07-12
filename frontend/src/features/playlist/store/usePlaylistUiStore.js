import { create } from 'zustand';

const usePlaylistUiStore = create((set) => ({
	expandedTextIds: {},
	toggleExpandedText: (id) =>
		set((state) => ({
			expandedTextIds: {
				...state.expandedTextIds,
				[id]: !state.expandedTextIds[id],
			},
		})),
	resetPlaylistUi: () => set({ expandedTextIds: {} }),
}));

export default usePlaylistUiStore;
