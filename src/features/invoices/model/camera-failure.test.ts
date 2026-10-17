import { describe, expect, it } from 'vitest';

import { classifyCameraFailure } from './camera-failure';

describe('classifyCameraFailure', () => {
  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED'],
    ['SecurityError', 'PERMISSION_DENIED'],
    ['NotFoundError', 'NO_CAMERA'],
    ['OverconstrainedError', 'NO_CAMERA'],
    ['NotReadableError', 'IN_USE'],
    ['AbortError', 'IN_USE'],
    ['TypeError', 'UNAVAILABLE'],
  ])('reads %s as %s', (name, expected) => {
    expect(classifyCameraFailure(new DOMException('x', name))).toBe(expected);
  });

  it('falls back to the generic failure for anything that is not an error of the media API', () => {
    expect(classifyCameraFailure(undefined)).toBe('UNAVAILABLE');
    expect(classifyCameraFailure('boom')).toBe('UNAVAILABLE');
    expect(classifyCameraFailure(new Error('could not load the reader'))).toBe('UNAVAILABLE');
  });
});
