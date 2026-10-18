/** The most the API accepts for a token; anything longer cannot be one it issued. */
const TOKEN_MAX_LENGTH = 256;

/**
 * The token out of the address of the link in the e-mail, which carries it in the
 * fragment (`#token=…`) so that it never reaches a server log or a `Referer`
 * header. `null` when there is none, or when what is there cannot be a token.
 *
 * Only the shape is checked. Whether the token is one the API issued, and still
 * works, is the API's to say.
 */
export function readResetToken(hash: string): string | null {
  const token = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('token');

  if (token === null || token === '' || token.length > TOKEN_MAX_LENGTH || /\s/.test(token)) {
    return null;
  }

  return token;
}
