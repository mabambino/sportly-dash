// Cryptographically secure random helpers.
//
// `Math.random()` is a non-cryptographic PRNG: its output is predictable from
// a known seed and must never be used to mint credentials. Everything in this
// module draws from the platform CSPRNG (`crypto.getRandomValues`), which is
// available in browsers, Node 20+ and workerd.

// 32 unambiguous characters — no I/L/O/0/1, so a human can read a temporary
// password off a screen without transcription errors. The length is a power of
// two, so masking the random byte introduces no modulo bias.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789#";

/**
 * Generate a random password.
 * @param length number of characters (default 16 → 80 bits of entropy)
 */
export function randomPassword(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}

/** Random lowercase hex token, e.g. for unique demo e-mail local parts. */
export function randomToken(bytes = 8): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
