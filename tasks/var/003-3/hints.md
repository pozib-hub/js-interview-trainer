## Подсказка 1
`var` поднимается (hoisting): `console.log(a)` → `undefined` (не `ReferenceError`). `let` не поднимается: `ReferenceError` (TDZ).

## Подсказка 2
Повторное `var a` — допустимо. Повторное `let a` в той же области → `SyntaxError`.
