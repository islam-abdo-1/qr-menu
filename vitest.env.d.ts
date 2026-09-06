/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

interface ImportMetaEnv {
  readonly PLAYWRIGHT_BASE_URL?: string;
  readonly VERCEL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  namespace Vi {
    interface Jest {
      fn<T extends (...args: any[]) => any>(implementation?: T): Mock<T>;
      fn<T>(implementation?: () => T): Mock<() => T>;
    }
  }

  const vi: Vi.Jest;

  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function expect<T>(actual: T): Assertions<T>;
  function beforeEach(fn: () => void | Promise<void>): void;
  function afterEach(fn: () => void | Promise<void>): void;
  function beforeAll(fn: () => void | Promise<void>): void;
  function afterAll(fn: () => void | Promise<void>): void;
}