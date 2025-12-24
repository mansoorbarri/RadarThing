// Fallback JSX declarations for typecheck tooling
// Actual projects should rely on @types/react, which is already installed.
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
