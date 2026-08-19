## Подсказка 1
`this.roles.map(function(role){...})` — внутри callback `this = undefined` (обычная функция, не метод объекта).

## Подсказка 2
`this.name` = `undefined` (strict mode) или `""` (window.name). Результат: `[" is friend", " is brother", " is student"]`.

## Подсказка 3
Решения:
- Стрелочная функция: `this.roles.map((role) => this.name + " is " + role)` — захватывает `this` из `getRoles`.
- `.bind(this)`: `this.roles.map(function(role){...}.bind(this))`.
