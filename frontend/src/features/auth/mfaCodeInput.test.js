import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onTestFinished } from 'vitest';
import { initMfaCodeInput } from './mfaCodeInput.js';

// Mirrors the markup of templates/mfa/authenticate.html that the script relies on.
function renderMfaForm() {
	const digits = [1, 2, 3, 4, 5, 6]
		.map((n) => `<input type="text" class="otp-digit" maxlength="1" inputmode="numeric" aria-label="Digit ${n}">`)
		.join('');
	document.body.innerHTML = `
		<p id="otp-instruction">Enter the 6-digit code from your authenticator app. It is verified as soon as you enter the last digit.</p>
		<p id="recovery-instruction" class="hidden">Enter your 12-digit recovery code to continue.</p>
		<form name="code" method="POST" action="/accounts/2fa/authenticate/" data-mfa-code-form>
			<div class="hidden"><input type="text" name="code" class="otp-hidden-input" required></div>
			<div id="otp-input-container">${digits}</div>
			<div id="recovery-input-container" class="!hidden">
				<label for="recovery-code">Backup code</label>
				<input type="text" id="recovery-code" inputmode="numeric">
			</div>
			<button type="submit">Verify</button>
		</form>
		<p id="mfa-alt-question">Don't have your authenticator app?</p>
		<button type="button" id="toggle-recovery-mode">Use a backup code</button>
	`;
	initMfaCodeInput();
	return document.querySelector('form');
}

function digitBox(n) {
	return screen.getByRole('textbox', { name: `Digit ${n}` });
}

function codeToSend(form) {
	return new FormData(form).get('code');
}

// Records the code of every submission the browser would send: a submit event that no handler cancelled.
function recordSubmissions() {
	const sent = [];
	function record(event) {
		if (!event.defaultPrevented) sent.push(codeToSend(event.target));
		event.preventDefault(); // jsdom cannot navigate.
	}
	window.addEventListener('submit', record);
	onTestFinished(() => window.removeEventListener('submit', record));
	return sent;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('MFA code input', () => {
	it('moves through the boxes as digits are typed and sends them as one code', async () => {
		const user = userEvent.setup();
		const form = renderMfaForm();

		await user.keyboard('123');

		expect(digitBox(4)).toHaveFocus();
		expect(codeToSend(form)).toBe('123');
	});

	it('spreads a pasted code across the boxes', async () => {
		const user = userEvent.setup();
		renderMfaForm();

		await user.paste('12-34');

		expect([1, 2, 3, 4, 5, 6].map((n) => digitBox(n).value)).toEqual(['1', '2', '3', '4', '', '']);
	});

	it('sends the backup code instead of the boxes after switching to backup-code mode', async () => {
		const user = userEvent.setup();
		const form = renderMfaForm();

		await user.click(screen.getByRole('button', { name: 'Use a backup code' }));
		await user.keyboard('1234 5678 9012');

		expect(codeToSend(form)).toBe('123456789012');
		expect(screen.getByRole('button', { name: 'Use 6-digit code' })).toBeInTheDocument();
	});

	describe('auto-submit', () => {
		it('sends the form once, with the code, as soon as the sixth digit is typed', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.keyboard('12345');
			expect(sent).toEqual([]);

			await user.keyboard('6');
			expect(sent).toEqual(['123456']);
		});

		it('sends the form once when a whole code is pasted', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.paste('123 456');

			expect(sent).toEqual(['123456']);
		});

		it('sends the form once when the browser autofills the whole code into the first box', () => {
			renderMfaForm();
			const sent = recordSubmissions();

			// One-time-code autofill sets the value directly, so maxlength does not split it.
			fireEvent.input(digitBox(1), { target: { value: '123456' } });

			expect(sent).toEqual(['123456']);
		});

		it('leaves a backup code for the Verify button to send', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.click(screen.getByRole('button', { name: 'Use a backup code' }));
			await user.keyboard('123456789012');
			expect(sent).toEqual([]);

			await user.click(screen.getByRole('button', { name: 'Verify' }));
			expect(sent).toEqual(['123456789012']);
		});

		it('does not send again when a digit is corrected after the code was sent', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.keyboard('123456');
			await user.keyboard('{Backspace}7');

			expect(digitBox(6)).toHaveValue('7');
			expect(sent).toEqual(['123456']);
		});

		it('does not send a second request when Verify is pressed after the code was sent', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.keyboard('123456');
			await user.click(screen.getByRole('button', { name: 'Verify' }));

			expect(sent).toEqual(['123456']);
		});

		it('sends a corrected code after the browser restores the page from its back-forward cache', async () => {
			const user = userEvent.setup();
			renderMfaForm();
			const sent = recordSubmissions();

			await user.keyboard('123456');
			window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
			await user.keyboard('{Backspace}7');

			expect(sent).toEqual(['123456', '123457']);
		});
	});
});
