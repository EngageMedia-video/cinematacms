import { cn } from '../../../shared/utils/classNames';

const SUB_STEP_ITEMS = [
	{ value: 'basic', label: 'Basic Details' },
	{ value: 'thumbnail', label: 'Thumbnail Image Upload' },
	{ value: 'other', label: 'Other Details' },
	{ value: 'final', label: 'Final Settings' },
];

/**
 * Horizontal indicator for the Enter-Details sub-steps. Clickable so users can
 * jump directly; the footer NEXT/BACK buttons also move between them.
 */
export function SubStepNav({ value, onChange }) {
	return (
		<nav
			aria-label="Detail sections"
			className="flex gap-1 overflow-x-auto border-b border-border-divider [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{SUB_STEP_ITEMS.map((item) => {
				const active = item.value === value;
				return (
					<button
						key={item.value}
						type="button"
						aria-current={active ? 'step' : undefined}
						onClick={() => onChange(item.value)}
						className={cn(
							'body-body-14-medium -mb-px shrink-0 cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent px-3 py-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
							active
								? 'border-border-input text-text-strong'
								: 'border-transparent text-text-muted hover:text-text-strong'
						)}
					>
						{item.label}
					</button>
				);
			})}
		</nav>
	);
}
