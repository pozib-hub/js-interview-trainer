export function fizzBuzz(n: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) {
      result.push('FooBar');
    } else if (i % 3 === 0) {
      result.push('Foo');
    } else if (i % 5 === 0) {
      result.push('Bar');
    } else {
      result.push(String(i));
    }
  }
  return result;
}
