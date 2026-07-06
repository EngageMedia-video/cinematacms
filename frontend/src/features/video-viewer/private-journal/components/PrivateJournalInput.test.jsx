import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PrivateJournalInput } from './PrivateJournalInput';

describe('PrivateJournalInput', () => {
	it('submits with Enter', () => {
		const onSubmit = vi.fn();

		render(<PrivateJournalInput value="A useful note" onChange={vi.fn()} onSubmit={onSubmit} />);

		fireEvent.keyDown(screen.getByPlaceholderText('Write a Note'), {
			key: 'Enter',
			code: 'Enter',
			keyCode: 13,
		});

		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it('keeps Shift+Enter available for a newline', () => {
		const onSubmit = vi.fn();

		render(<PrivateJournalInput value="A useful note" onChange={vi.fn()} onSubmit={onSubmit} />);

		fireEvent.keyDown(screen.getByPlaceholderText('Write a Note'), {
			key: 'Enter',
			code: 'Enter',
			keyCode: 13,
			shiftKey: true,
		});

		expect(onSubmit).not.toHaveBeenCalled();
	});
});
