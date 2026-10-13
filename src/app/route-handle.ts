/**
 * What a route says about itself to the shell. Only the breadcrumb label for
 * now; a route with none (the "not found" page) simply adds nothing to it.
 */
export interface RouteHandle {
  crumb?: string;
}

export function crumbOf(handle: unknown): string | null {
  if (typeof handle !== 'object' || handle === null || !('crumb' in handle)) {
    return null;
  }

  return typeof handle.crumb === 'string' ? handle.crumb : null;
}
