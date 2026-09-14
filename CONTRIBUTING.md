# Контрибьюция в USS

Спасибо за интерес к проекту! Это руководство поможет вам начать работу.

## Начало работы

1. **Fork** репозиторий [USS](https://github.com/x18255914022/USS/fork)
2. **Клонируйте** свой форк:
   ```bash
   git clone https://github.com/<ваш-username>/USS.git
   cd USS
   ```
3. **Создайте ветку** для вашей фичи или исправления:
   ```bash
   git checkout -b feature/название-фичи
   ```

## Настройка окружения

Следуйте инструкциям в [README.md](./README.md#быстрый-старт-локально) для установки зависимостей и запуска проекта.

## Стандарты кода

- **Форматирование:** [Prettier](https://prettier.io/) — запуск: `pnpm format`
- **Линтинг:** ESLint — запуск: `pnpm lint`
- Проверяйте код перед каждым коммитом:
  ```bash
  pnpm lint && pnpm format
  ```

## Коммиты

Следуйте [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: добавить экспорт расписания в PDF
fix: исправить отображение пар в субботу
docs: обновить README
chore: обновить зависимости
```

## Pull Request

1. Убедитесь, что все тесты проходят:
   ```bash
   pnpm --filter @app/api test:unit
   pnpm --filter @app/api test:integration
   pnpm --filter @app/worker test
   ```
2. Обновите документацию, если затронут публичный API или поведение.
3. Откройте PR в `main` с описанием что и почему вы изменили.
4. Дождитесь review — минимум одно одобрение перед мержем.

## Сообщество

- Будьте уважительны к другим участникам.
- Следуйте [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
- Если у вас есть вопросы — откройте [issue](https://github.com/x18255914022/USS/issues/new).
