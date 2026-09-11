/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The page may load only its own files and may not open any connection.
 * src-tauri/tauri.conf.json carries the same policy for the desktop app, with
 * connect-src opened only to Tauri's channel between the page and the Rust side.
 * Keep the two in step.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  // The favicon and the select arrow are inline SVG data URIs.
  "img-src 'self' data:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * Set by the Tauri CLI while it builds the desktop app. Tauri injects that app's
 * policy itself, and a second one from the meta tag would also cut the channel
 * between the page and the Rust side.
 */
const DESKTOP_BUILD = process.env.TAURI_ENV_PLATFORM !== undefined;

/** Build only: `connect-src 'none'` would cut the dev server's hot-reload socket. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) => ({
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ],
    }),
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), ...(DESKTOP_BUILD ? [] : [contentSecurityPolicy()])],
  build: {
    // The polyfill preloads modules with fetch(), which the policy forbids.
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
  },
});
