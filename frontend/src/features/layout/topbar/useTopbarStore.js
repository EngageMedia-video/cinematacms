import { create } from 'zustand';

const useTopbarStore = create((set) => ({
	isMobileSearchOpen: false,
	isUserMenuOpen: false,
	openMobileSearch: () => set({ isMobileSearchOpen: true }),
	closeMobileSearch: () => set({ isMobileSearchOpen: false }),
	toggleUserMenu: () => set((state) => ({ isUserMenuOpen: !state.isUserMenuOpen })),
	closeUserMenu: () => set({ isUserMenuOpen: false }),
}));

export default useTopbarStore;
export { useTopbarStore };
