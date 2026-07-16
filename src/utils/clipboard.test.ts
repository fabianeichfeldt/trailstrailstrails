import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('copyToClipboard', () => {
  afterEach(() => {
    stubClipboard(undefined);
  });

  it('writes the given text to the clipboard and resolves true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    const result = await copyToClipboard('hello world');

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(result).toBe(true);
  });

  it('resolves false when the clipboard API is unavailable', async () => {
    const result = await copyToClipboard('hello world');

    expect(result).toBe(false);
  });

  it('resolves false when writeText rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    stubClipboard({ writeText });

    const result = await copyToClipboard('hello world');

    expect(result).toBe(false);
  });
});
