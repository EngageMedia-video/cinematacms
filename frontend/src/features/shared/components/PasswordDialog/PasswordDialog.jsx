import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '../Dialog';
import { postRequest, getCSRFToken } from '../../../../static/js/functions';
import cornerDecoration from '../ConfirmationDialog/assets/confirmation-corner.webp';

export function PasswordDialog({ open, onOpenChange, friendlyToken, ownerName, ownerUrl, onSuccess }) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const inputRef = useRef(null);
	const errorId = 'password-dialog-error';

	function handleSubmit(e) {
		e.preventDefault();
		if (!password || submitting) return;

		setSubmitting(true);
		setError('');

		const url = `/api/v1/media/${friendlyToken}/password`;

		postRequest(
			url,
			{ password },
			{ headers: { 'X-CSRFToken': getCSRFToken() } },
			true,
			(response) => {
				setSubmitting(false);
				if (response?.data?.token) {
					onSuccess(response.data.token);
				} else {
					setError('An error occurred. Please try again.');
				}
			},
			(err) => {
				setSubmitting(false);
				const status = err?.response?.status;
				const detail = err?.response?.data?.detail;

				if (status === 429) {
					setError(detail || 'Too many attempts. Please try again later.');
				} else if (status === 403) {
					setError(detail || 'The password is incorrect.');
					setPassword('');
					inputRef.current?.focus();
				} else {
					setError('An error occurred. Please try again.');
				}
			}
		);
	}

	function handleOpenChange(nextOpen) {
		if (!nextOpen) {
			setPassword('');
			setError('');
		}
		onOpenChange?.(nextOpen);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				ariaLabel="Enter password to view media"
				className="max-w-[560px] min-w-[320px] bg-transparent p-0 text-left shadow-none"
				closeOnOverlayClick={false}
			>
				<div className="relative z-[1] w-full max-w-[560px] mx-auto px-9 pt-10 pb-9 bg-[var(--cinemata-pacific-deep-900)] rounded-2xl border border-[rgba(123,152,182,0.2)] overflow-hidden">
					<img
						src={cornerDecoration}
						alt=""
						aria-hidden="true"
						className="absolute -right-5 -bottom-5 w-[200px] max-w-[50%] opacity-15 pointer-events-none"
					/>

					<form onSubmit={handleSubmit} className="relative z-[1] flex flex-col items-center text-center">
						<span
							className="material-icons mb-4 text-[var(--cinemata-pacific-deep-300)]"
							style={{ fontSize: 72 }}
							aria-hidden="true"
						>
							lock
						</span>

						<h2 className="m-0 p-0 font-['Barlow_Semi_Condensed'] text-[28px] font-medium text-white leading-[1.3]">
							Enter Password to Access.
						</h2>

						<p className="mt-2.5 px-4 text-[15px] text-[var(--cinemata-pacific-deep-300)] leading-[1.5]">
							{ownerName ? (
								<>
									{"If you don't have access, please reach out to "}
									{ownerUrl ? (
										<a
											href={ownerUrl}
											className="text-white font-semibold no-underline hover:underline"
										>
											{ownerName}
										</a>
									) : (
										<strong>{ownerName}</strong>
									)}
									{' via their About page to request access.'}
								</>
							) : (
								'Enter the password to view this media.'
							)}
						</p>

						{error ? (
							<div
								id={errorId}
								role="alert"
								className="w-full mt-5 px-4 py-2.5 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[#fca5a5] text-sm text-left"
							>
								{error}
							</div>
						) : null}

						<div className="flex gap-3 w-full mt-7">
							<input
								ref={inputRef}
								type="password"
								aria-label="Media password"
								autoComplete="current-password"
								aria-invalid={!!error || undefined}
								aria-describedby={error ? errorId : undefined}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter Password"
								disabled={submitting}
								className="flex-1 min-w-0 px-5 py-3.5 rounded-[10px] border border-[rgba(123,152,182,0.25)] bg-[rgba(11,45,74,0.8)] text-white text-[15px] outline-none placeholder:text-[#5a7999] focus:border-[var(--cinemata-pacific-deep-300)] transition-[border-color] duration-200"
							/>
							<button
								type="submit"
								disabled={submitting || !password}
								className="shrink-0 px-7 py-3.5 border-none rounded-[10px] bg-[var(--cinemata-sunset-horizon-300)] text-white text-[15px] font-bold tracking-[0.5px] cursor-pointer hover:bg-[#c2692f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
							>
								{submitting ? 'Verifying...' : 'UNLOCK'}
							</button>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
