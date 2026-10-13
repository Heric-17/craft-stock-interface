/**
 * Testing Library collapses every run of whitespace, and a non-breaking space
 * counts as whitespace, so a query written with `NON_BREAKING_SPACE` finds
 * nothing under the default normaliser: the text it compares against has
 * already lost the character the test is about. This one leaves the text as the
 * screen wrote it.
 */
export const VERBATIM = { normalizer: (text: string) => text };
