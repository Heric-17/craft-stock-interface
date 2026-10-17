/**
 * Why the camera could not be opened, in the terms the screen speaks to the
 * person: each one has a different way out, so each one has its own sentence.
 */
export type CameraFailure = 'PERMISSION_DENIED' | 'NO_CAMERA' | 'IN_USE' | 'UNAVAILABLE';

/**
 * Reads the failure of `getUserMedia` by the name of the error the browser
 * raised, which is the contract of the media API. Anything else — a browser
 * that never offered the API, a failure while loading the reader — is the
 * generic one.
 */
export function classifyCameraFailure(error: unknown): CameraFailure {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'PERMISSION_DENIED';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'NO_CAMERA';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'IN_USE';
    default:
      return 'UNAVAILABLE';
  }
}
