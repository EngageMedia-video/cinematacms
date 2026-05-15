import { cn } from '../../utils/classNames';
import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';

export function GetNotifiedButton({ notified = false, className = '', onMouseEnter, onMouseLeave, ...props }) {
	const bellIconRef = useRef(null);
	const previousNotifiedRef = useRef(notified);

	useEffect(() => {
		if (notified && !previousNotifiedRef.current) {
			bellIconRef.current?.animate?.(
				[
					{ transform: 'translateX(0)' },
					{ transform: 'translateX(-2px)' },
					{ transform: 'translateX(2px)' },
					{ transform: 'translateX(-2px)' },
					{ transform: 'translateX(0)' },
				],
				{
					duration: 220,
					easing: 'ease-in-out',
				}
			);
		}

		previousNotifiedRef.current = notified;
	}, [notified]);

	return (
		<Button
			variant="primary"
			className={cn(className)}
			aria-label={props['aria-label'] ?? 'Get Notified'}
			aria-pressed={notified}
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			{...props}
		>
			<span className="inline-flex items-center justify-center gap-(--space-xs) leading-none">
				<span
					ref={bellIconRef}
					aria-hidden="true"
					className="inline-flex shrink-0 items-center justify-center leading-none [&_svg]:h-full [&_svg]:w-full"
					style={{ width: 'var(--size-20)', height: 'var(--size-20)' }}
				>
					<Icon name="notificationBell" decorative data-testid="bell-icon" size="sm" />
				</span>
				{notified ? (
					<span
						aria-hidden="true"
						className="inline-flex shrink-0 items-center justify-center leading-none [&_svg]:h-full [&_svg]:w-full"
						style={{ width: 'var(--size-20)', height: 'var(--size-20)' }}
					>
						<Icon name="check" decorative data-testid="check-icon" size="sm" />
					</span>
				) : (
					<span className="body-body-14-bold">GET NOTIFIED</span>
				)}
			</span>
		</Button>
	);
}
