# Угадай кто? v0.2

Casual multiplayer Guess Who на React, TypeScript, Vite, Express и Socket.IO. Регистрация и база данных не нужны: комнаты живут в памяти Node.js.

## Локальный запуск

Требуется Node.js 18+.

```bash
npm install
npm run dev
```

Откройте http://localhost:5173. Создайте комнату, выберите тему и скопируйте invite-ссылку вида `http://localhost:5173/join/K7MX2` во второе окно.

## Production-проверка

```bash
npm run build
npm start
```

Откройте http://localhost:3001. Express раздаёт `client/dist`, API и Socket.IO с одного origin. Health check: http://localhost:3001/api/health.

## Render

Создайте один Web Service из репозитория:

- Build Command: `npm install && npm run build`
- Start Command: `npm start`
- Environment Variables: не требуются

Сервер использует `process.env.PORT`, слушает `0.0.0.0`, а клиент подключается к Socket.IO через текущий origin.

## Что внутри

Темы централизованы на сервере: Животные, Еда, Транспорт, Страны и оригинальные Персонажи — по 24 карточки на тему. Сервер authoritative для комнаты, темы, секретов, фаз `waiting_for_question`/`waiting_for_answer`, ответов, ходов и результата. Закрытые карточки — локальное состояние браузера. Код комнаты и имя сохраняются в `localStorage`, а уникальный токен текущей вкладки — в `sessionStorage`: это позволяет тестировать двух игроков в двух вкладках одного браузера и сохранять reconnect после F5 в той же вкладке.

## Ограничения v0.2

Данные комнат не переживают перезапуск сервера; Redis и база данных не используются. Комната удаляется через 2 минуты после отключения обоих игроков. Звуки генерируются Web Audio API и могут быть заблокированы браузером до первого взаимодействия. Масштабирование на несколько server instances без sticky sessions/общего хранилища не предусмотрено.
