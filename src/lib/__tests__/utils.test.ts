import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('foo', 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('foo', true && 'bar', false && 'baz');
      expect(result).toBe('foo bar');
    });

    it('should merge Tailwind classes and resolve conflicts', () => {
      const result = cn('px-2', 'px-4');
      expect(result).toBe('px-4'); // Last one wins
    });

    it('should handle empty strings', () => {
      const result = cn('foo', '');
      expect(result).toBe('foo');
    });

    it('should handle null and undefined', () => {
      const result = cn('foo', null, undefined, 'bar');
      expect(result).toBe('foo bar');
    });

    it('should handle objects', () => {
      const result = cn({ foo: true, bar: false, baz: true });
      expect(result).toBe('foo baz');
    });

    it('should handle arrays', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toBe('foo bar');
    });

    it('should handle mixed inputs', () => {
      const result = cn('foo', { bar: true }, ['baz', 'qux']);
      expect(result).toBe('foo bar baz qux');
    });
  });
});

