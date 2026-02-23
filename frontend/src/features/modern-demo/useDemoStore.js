import { create } from 'zustand';

const useDemoStore = create((set) => ({
	viewMode: 'grid',
	searchQuery: '',
	setViewMode: (mode) => set({ viewMode: mode }),
	setSearchQuery: (query) => set({ searchQuery: query }),
}));

export default useDemoStore;
