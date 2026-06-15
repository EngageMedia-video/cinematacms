import { cn } from '../../shared/utils/classNames';

/**
 * Editorial-policy reminder shown above the upload form on both the single and
 * bulk flows. "Editorial Policy" is a real link to the portal's policy page
 * (matches the legacy edit/upload pages and the Figma reference).
 */
export function EditorialPolicyNotice({ className = '' }) {
	return (
		<p className={cn('body-body-14-regular text-text-muted', className)}>
			Please check our{' '}
			<a
				href="/editorial-policy"
				className="font-semibold text-text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
			>
				Editorial Policy
			</a>{' '}
			before uploading media. Any media that does not comply with the policy will be deleted from Cinemata.org.
		</p>
	);
}
