## Подсказка 1
`object.foo()` — `this = object`, `this.data = "Some Data"`. Внутри `foo` обычная функция `bar()` вызывается без контекста.

## Подсказка 2
`bar()` — не метод объекта, а обычный вызов. `this = undefined` (strict mode). `this.data` = `undefined`.
