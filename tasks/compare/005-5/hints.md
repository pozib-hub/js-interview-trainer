## Подсказка 1
Function declaration полностью поднимается: `typeof f1` → `"function"`. `var f2` поднимается, но присваивание — нет: `typeof f2` → `"undefined"`. `let f3` — TDZ: `typeof f3` → `"undefined"` (доступ до объявления).

## Подсказка 2
`undefined && (4 & 7)` → `undefined` (&& возвращает первый falsy). `undefined || 7 || 8` → `7`. `(7 && 8) || 6` → `8`.
