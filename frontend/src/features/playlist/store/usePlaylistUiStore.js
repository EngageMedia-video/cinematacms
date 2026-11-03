import { create } from 'zustand';

const usePlaylistUiStore = create((set) => ({
	editDialogOpen: false,
	expandedTextIds: {},
	setEditDialogOpen: (editDialogOpen) => set({ editDialogOpen }),
	toggleExpandedText: (id) =>
		set((state) => ({
			expandedTextIds: {
				...state.expandedTextIds,
				[id]: !state.expandedTextIds[id],
			},
		})),
	resetPlaylistUi: () => set({ editDialogOpen: false, expandedTextIds: {} }),
}));

export default usePlaylistUiStore;
