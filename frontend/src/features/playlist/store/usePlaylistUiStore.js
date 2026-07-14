import { create } from 'zustand';

const usePlaylistUiStore = create((set) => ({
	descriptionDialogOpen: false,
	expandedTextIds: {},
	setDescriptionDialogOpen: (descriptionDialogOpen) => set({ descriptionDialogOpen }),
	toggleExpandedText: (id) =>
		set((state) => ({
			expandedTextIds: {
				...state.expandedTextIds,
				[id]: !state.expandedTextIds[id],
			},
		})),
	resetPlaylistUi: () => set({ descriptionDialogOpen: false, expandedTextIds: {} }),
}));

export default usePlaylistUiStore;
