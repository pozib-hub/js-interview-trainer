// O(n + m) по времени    O(n) по памяти (так как создаем Set).
export function findIntersection(arr1: number[], arr2: number[]) {
  const set1 = new Set(arr1);

  const result = [];

  for (let num2 of arr2) {
    if (set1.has(num2)) {
      result.push(num2);
      set1.delete(num2);
    }
  }
  return result;
}

// O(n + m) по времени    O(n) по памяти (так как создаем Set).
export const findIntersection2 = (arr1: number[], arr2: number[]): number[] => {
  const set1 = new Set(arr1);
  return [...new Set(arr2.filter((num) => set1.has(num)))];
};

console.log(findIntersection([1, 4, 5, 10, 8], [1, 8, 7, 9, 5]));
console.log(findIntersection2([1, 4, 5, 10, 8], [1, 8, 7, 9, 5]));