// jest-dom adds custom matchers for asserting on DOM nodes, e.g.
// expect(element).toHaveTextContent(/react/i)
import '@testing-library/jest-dom/vitest';
import { randomUUID, webcrypto } from 'node:crypto';

// Ensure crypto.randomUUID exists in the test environment (the app uses it for ids).
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = webcrypto;
}
if (typeof (globalThis as any).crypto.randomUUID !== 'function') {
  (globalThis as any).crypto.randomUUID = randomUUID;
}
