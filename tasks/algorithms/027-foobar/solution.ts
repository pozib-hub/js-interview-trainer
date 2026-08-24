export function foobar(n: number): string | number {
  if (n % 15 === 0) return 'FooBar';
  if (n % 3 === 0) return 'Foo';
  if (n % 5 === 0) return 'Bar';
  return n;
}
