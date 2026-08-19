export function reverseWords(str: string): string {
  let result = "";

  const words = str.split(" ");

  for (let i = 0; i < words.length; i++) {
    // const reversedWord = words[i].split("").reverse().join("");

    const word = words[i];
    let reversedWord = "";

    for (let j = word.length - 1; j >= 0; j--) {
      reversedWord += word[j];
    }

    result += reversedWord + " ";
  }

  return result;
}

console.log(reverseWords("hello world"));

export const reverseWordsMap = (str = "") =>
  str
    .split(" ")
    .map((word) => word.split("").reverse().join(""))
    .join(" ");

console.log(reverseWordsMap("hello world")); // "olleh dlrow"