import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// React Testing Library only registers its own cleanup when vitest globals are
// enabled; this project imports them explicitly instead.
afterEach(cleanup);
