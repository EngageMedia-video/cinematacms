import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '../Dialog';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { postRequest, getCSRFToken } from '../../../../static/js/functions';

export function PasswordDialog({ open, onOpenChange, friendlyToken, ownerName, ownerUrl, onSuccess, onClose }) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const inputRef = useRef(null);

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
					setError(detail || 'Incorrect password.');
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
			onClose?.();
		}
		onOpenChange?.(nextOpen);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent
				ariaLabel="Enter password to view media"
				className="max-w-[480px] min-w-[320px] bg-transparent p-0 text-left shadow-none"
			>
				<div className="relative overflow-hidden rounded-2xl border-[0.5px] border-cinemata-neutral-300 bg-linear-to-br from-cinemata-white to-cinemata-neutral-50 p-[26px] dark:border-cinemata-strait-blue-300 dark:from-cinemata-pacific-deep-900 dark:to-cinemata-pacific-deep-950">
					<form onSubmit={handleSubmit} className="relative z-10 flex flex-col">
						<div className="flex flex-col items-center text-center">
							<span className="material-icons text-[56px] text-cinemata-strait-blue-600p dark:text-cinemata-strait-blue-400">
								lock
							</span>
							<h2 className="heading-h5-24-medium m-0 mt-4 p-0 text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
								Enter Password to Access
							</h2>
							<p className="body-body-14-regular m-0 mt-2 p-0 text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300">
								{ownerName ? (
									<>
										{"If you don't have access, please reach out to "}
										{ownerUrl ? (
											<a
												href={ownerUrl}
												className="font-medium text-cinemata-strait-blue-600p hover:underline dark:text-cinemata-sunset-horizon-300"
											>
												{ownerName}
											</a>
										) : (
											<span className="font-medium">{ownerName}</span>
										)}
										{' via their About page to request access.'}
									</>
								) : (
									'Enter the password to view this media.'
								)}
							</p>
						</div>

						{error ? (
							<div
								role="alert"
								className="body-body-14-regular mt-6 rounded-ds-4 border border-cinemata-red-300 bg-cinemata-red-50 px-4 py-3 text-cinemata-red-700p dark:border-cinemata-red-500/30 dark:bg-cinemata-red-900/20 dark:text-cinemata-red-400"
							>
								{error}
							</div>
						) : null}

						<div className="mt-6">
							<TextField
								ref={inputRef}
								type="password"
								label="Enter Password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								invalid={!!error}
								disabled={submitting}
								className="w-full"
							/>
						</div>

						<div className="mt-8 flex items-center justify-end gap-3">
							<Dialog.Close>
								<Button variant="primary-outline" type="button">
									Cancel
								</Button>
							</Dialog.Close>
							<Button variant="secondary" type="submit" disabled={submitting || !password}>
								{submitting ? 'Verifying...' : 'UNLOCK'}
							</Button>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
