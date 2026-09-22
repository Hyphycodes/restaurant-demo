/**
 * Stand-in for the `server-only` package under vitest.
 *
 * The real package exports nothing and exists purely so that a client component
 * importing a server module fails at build time. Tests run outside that bundler,
 * so this empty module lets a server module be imported directly without
 * removing the marker from the source.
 */
export {};
