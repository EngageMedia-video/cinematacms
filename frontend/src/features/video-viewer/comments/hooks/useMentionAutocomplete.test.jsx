import { render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const instances = [];

vi.mock('tributejs', () => ({
	default: class TributeMock {
		constructor(options) {
			this.options = options;
			this.isActive = false;
			this.attached = [];
			this.detached = [];
			instances.push(this);
		}
		attach(element) {
			this.attached.push(element);
		}
		detach(element) {
			this.detached.push(element);
		}
	},
}));

const { useMentionAutocomplete } = await import('./useMentionAutocomplete');

function Harness({ onReplace, enabled = true, exposeApi }) {
	const inputRef = useRef(null);
	const api = useMentionAutocomplete({ inputRef, onReplace, enabled });
	exposeApi?.(api);
	return <input ref={inputRef} aria-label="comment" />;
}

describe('useMentionAutocomplete', () => {
	beforeEach(() => {
		instances.length = 0;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('attaches Tribute to the input and detaches on unmount', () => {
		const { getByLabelText, unmount } = render(<Harness onReplace={vi.fn()} />);
		const input = getByLabelText('comment');

		expect(instances).toHaveLength(1);
		expect(instances[0].attached).toEqual([input]);

		unmount();
		expect(instances[0].detached).toEqual([input]);
	});

	it('does not attach when disabled', () => {
		render(<Harness onReplace={vi.fn()} enabled={false} />);

		expect(instances).toHaveLength(0);
	});

	it('reports whether the menu is open', () => {
		let api;
		render(<Harness onReplace={vi.fn()} exposeApi={(value) => (api = value)} />);

		expect(api.isMenuOpen()).toBe(false);
		instances[0].isActive = true;
		expect(api.isMenuOpen()).toBe(true);
	});

	it('pushes the replaced input value and the picked person back to the caller', () => {
		const onReplace = vi.fn();
		const { getByLabelText } = render(<Harness onReplace={onReplace} />);
		const input = getByLabelText('comment');
		const picked = { username: 'alice', name: 'Alice Anderson' };

		input.value = 'hi @alice ';
		input.dispatchEvent(new CustomEvent('tribute-replaced', { detail: { item: { original: picked } } }));

		expect(onReplace).toHaveBeenCalledWith('hi @alice ', picked);
	});

	it('feeds suggestions from the API into the menu', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: async () => [{ username: 'alice', name: 'Alice' }] })
		);
		render(<Harness onReplace={vi.fn()} />);
		const populate = vi.fn();

		instances[0].options.values('al', populate);

		await waitFor(() => expect(populate).toHaveBeenCalledWith([{ username: 'alice', name: 'Alice' }]));
	});

	it('falls back to an empty menu when the request fails', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		render(<Harness onReplace={vi.fn()} />);
		const populate = vi.fn();

		instances[0].options.values('al', populate);

		await waitFor(() => expect(populate).toHaveBeenCalledWith([]));
	});

	it('inserts the plain handle when a person is picked', () => {
		render(<Harness onReplace={vi.fn()} />);

		expect(instances[0].options.selectTemplate({ original: { username: 'alice' } })).toBe('@alice');
	});

	it('escapes user-controlled text in the menu markup', () => {
		render(<Harness onReplace={vi.fn()} />);

		const html = instances[0].options.menuItemTemplate({
			original: { username: 'x', name: '<img src=x onerror=alert(1)>', thumbnail_url: null },
		});

		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
	});

	it('rejects an avatar URL that is not same-origin or http(s)', () => {
		render(<Harness onReplace={vi.fn()} />);

		const html = instances[0].options.menuItemTemplate({
			original: { username: 'x', name: 'X', thumbnail_url: 'javascript:alert(1)' },
		});

		expect(html).not.toContain('javascript:');
	});
});
