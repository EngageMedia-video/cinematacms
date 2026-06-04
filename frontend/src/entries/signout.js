import '../features/auth/logoutModal.css';
import { initLogoutModal } from '../features/auth/logoutModal.js';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initLogoutModal);
} else {
	initLogoutModal();
}
