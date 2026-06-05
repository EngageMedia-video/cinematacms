import '../features/auth/auth-enhancements.css';
import { initToast } from '../features/auth/toast.js';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initToast);
} else {
	initToast();
}
