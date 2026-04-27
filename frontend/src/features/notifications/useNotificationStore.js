import { create } from 'zustand';

const useNotificationStore = create((set) => ({
	isDropdownOpen: false,
	openDropdown: () => set({ isDropdownOpen: true }),
	closeDropdown: () => set({ isDropdownOpen: false }),
	toggleDropdown: () => set((s) => ({ isDropdownOpen: !s.isDropdownOpen })),
}));

export default useNotificationStore;
