import { create } from 'zustand';

const usePlaylistUiStore = create((set) => ({
	curatorNoteDialogOpen: false,
	expandedTextIds: {},
	setCuratorNoteDialogOpen: (curatorNoteDialogOpen) => set({ curatorNoteDialogOpen }),
	toggleExpandedText: (id) =>
		set((state) => ({
			expandedTextIds: {
				...state.expandedTextIds,
				[id]: !state.expandedTextIds[id],
			},
		})),
	resetPlaylistUi: () => set({ curatorNoteDialogOpen: false, expandedTextIds: {} }),
}));

export default usePlaylistUiStore;
