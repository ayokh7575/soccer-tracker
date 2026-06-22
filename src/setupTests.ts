// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { randomUUID, webcrypto } from 'crypto';

// jsdom / Node 16 don't expose global crypto.randomUUID, which the app uses to
// generate IDs. Polyfill it so components work under test.
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = webcrypto;
}
if (typeof (global as any).crypto.randomUUID !== 'function') {
  (global as any).crypto.randomUUID = randomUUID;
}
