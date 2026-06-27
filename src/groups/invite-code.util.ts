import { customAlphabet } from 'nanoid';

// 8-char alphanumeric codes: easy to share via WhatsApp/Signal
// ~2.8 trillion combinations (62^8) — collision-safe for our scale
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 8);

export function generateInviteCode(): string {
  return nanoid();
}
