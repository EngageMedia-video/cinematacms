import { Icon } from '../../shared/components/Icon';

export function LoadingState() {
	return (
		<div
			role="status"
			aria-live="polite"
			className="flex items-center justify-center gap-2 px-6 py-10 text-cinemata-pacific-deep-300"
		>
			<span className="inline-flex h-5 w-5 animate-spin items-center justify-center">
				<Icon name="loading" size={20} decorative />
			</span>
			<span className="body-body-12-regular">Searching...</span>
		</div>
	);
}
