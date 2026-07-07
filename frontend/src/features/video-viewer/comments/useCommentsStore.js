import { create } from 'zustand';

const useCommentsStore = create((set) => ({
	isExpanded: false,
	openExpanded: () => set({ isExpanded: true }),
	closeExpanded: () => set({ isExpanded: false }),
	toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
}));

export default useCommentsStore;
