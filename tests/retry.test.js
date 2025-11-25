import { describe, it, expect, vi } from 'vitest';
import { withRetry, withHttpRetry, RetryStrategies } from '../lib/retry.js';

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries exceeded', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 }))
      .rejects.toThrow('persistent failure');

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should respect shouldRetry option', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

    await expect(withRetry(fn, {
      maxRetries: 3,
      shouldRetry: () => false
    })).rejects.toThrow('non-retryable');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    await withRetry(fn, { maxRetries: 2, baseDelay: 10, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 0, expect.any(Number));
  });
});

describe('withHttpRetry', () => {
  it('should retry on retryable status codes', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue('success');

    const result = await withHttpRetry(fn, [503], { maxRetries: 2, baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable status codes', async () => {
    const fn = vi.fn().mockRejectedValue({ response: { status: 400 } });

    await expect(withHttpRetry(fn, [503], { maxRetries: 2 }))
      .rejects.toEqual({ response: { status: 400 } });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValue('success');

    const result = await withHttpRetry(fn, [503], { maxRetries: 2, baseDelay: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('RetryStrategies', () => {
  it('should have STANDARD strategy with correct defaults', () => {
    expect(RetryStrategies.STANDARD).toBeDefined();
    expect(RetryStrategies.STANDARD.maxRetries).toBe(3);
    expect(RetryStrategies.STANDARD.baseDelay).toBe(1000);
    expect(RetryStrategies.STANDARD.maxDelay).toBe(30000);
  });
});
