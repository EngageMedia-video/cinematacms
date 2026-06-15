import { cn } from '../../shared/utils/classNames';

/**
 * Section/field label with an optional required marker. Used by field groups
 * that don't go through TextField/Dropdown/EditorField (which render their own
 * floating label) — e.g. checkbox groups and radio groups.
 */
export function FieldLabel({ children, htmlFor, required = false, className = '', id }) {
	return (
		<label id={id} htmlFor={htmlFor} className={cn('body-body-16-regular mb-2 block text-text-strong', className)}>
			{children}
			{required ? (
				<span className="text-text-accent" aria-hidden="true">
					{' '}
					*
				</span>
			) : null}
		</label>
	);
}
