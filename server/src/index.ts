import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { existsSync } from "fs";
import { join } from "path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { selectRandomCards } from "./selectRandomCards.js";
type Card = { id: string; name: string; visual: string; image?: string };
type Theme = { id: string; name: string; icon: string; cards: Card[] };
type Player = {
  token: string;
  socketId?: string;
  nickname: string;
  ready: boolean;
  secret?: string;
  connected: boolean;
};
type Round = {
  id: string;
  question: string;
  questioner: string;
  answer?: "yes" | "no" | "unknown";
};
type Room = {
  code: string;
  themeId: string;
  cardIds: string[];
  players: Player[];
  phase:
    | "waiting"
    | "selecting"
    | "waiting_for_question"
    | "waiting_for_answer"
    | "finished";
  turn?: string;
  rounds: Round[];
  winner?: string;
  lastEvent?: string;
};
const cards = (items: string[]) =>
  items.map((v, i) => {
    const [visual, name] = v.split("|");
    return { id: String(i + 1), name, visual };
  });
const dotaHeroes = createRequire(import.meta.url)(
  fileURLToPath(new URL("../src/dotaHeroes.json", import.meta.url)),
) as { id: string; name: string; image: string }[];
const dotaCards: Card[] = dotaHeroes.map((hero) => ({ ...hero, visual: "⚔️" }));
export const themes: Theme[] = [
  {
    id: "animals",
    name: "Животные",
    icon: "🐾",
    cards: cards([
      "🦁|Лев",
      "🐯|Тигр",
      "🐼|Панда",
      "🐨|Коала",
      "🐸|Лягушка",
      "🐵|Обезьяна",
      "🦊|Лиса",
      "🐺|Волк",
      "🐷|Свинья",
      "🐮|Корова",
      "🐰|Кролик",
      "🐻|Медведь",
      "🐔|Курица",
      "🐧|Пингвин",
      "🦉|Сова",
      "🐙|Осьминог",
      "🐢|Черепаха",
      "🐬|Дельфин",
      "🦈|Акула",
      "🐘|Слон",
      "🦒|Жираф",
      "🦓|Зебра",
      "🦀|Краб",
      "🐊|Крокодил",
    ]),
  },
  {
    id: "food",
    name: "Еда",
    icon: "🍕",
    cards: cards([
      "🍕|Пицца",
      "🍔|Бургер",
      "🍣|Суши",
      "🌮|Тако",
      "🍜|Рамен",
      "🍩|Пончик",
      "🍪|Печенье",
      "🍎|Яблоко",
      "🍌|Банан",
      "🍉|Арбуз",
      "🍓|Клубника",
      "🥑|Авокадо",
      "🥕|Морковь",
      "🌽|Кукуруза",
      "🍿|Попкорн",
      "🍦|Мороженое",
      "🎂|Торт",
      "🍫|Шоколад",
      "🥨|Крендель",
      "🧀|Сыр",
      "🍞|Хлеб",
      "🥗|Салат",
      "🍇|Виноград",
      "🍋|Лимон",
    ]),
  },
  {
    id: "transport",
    name: "Транспорт",
    icon: "🚗",
    cards: cards([
      "🚗|Автомобиль",
      "🚕|Такси",
      "🚌|Автобус",
      "🚓|Полиция",
      "🚑|Скорая помощь",
      "🚒|Пожарная машина",
      "🚲|Велосипед",
      "🛴|Самокат",
      "🏍️|Мотоцикл",
      "✈️|Самолёт",
      "🚁|Вертолёт",
      "🚀|Ракета",
      "🚂|Поезд",
      "🚢|Корабль",
      "⛵|Парусник",
      "🚤|Катер",
      "🚜|Трактор",
      "🚚|Грузовик",
      "🚋|Трамвай",
      "🚇|Метро",
      "🚡|Канатная дорога",
      "🛻|Пикап",
      "🛶|Каноэ",
      "🛸|Летающая тарелка",
    ]),
  },
  {
    id: "countries",
    name: "Страны",
    icon: "🌍",
    cards: cards([
      "🇷🇺|Россия",
      "🇺🇸|США",
      "🇨🇦|Канада",
      "🇧🇷|Бразилия",
      "🇬🇧|Великобритания",
      "🇫🇷|Франция",
      "🇩🇪|Германия",
      "🇮🇹|Италия",
      "🇪🇸|Испания",
      "🇯🇵|Япония",
      "🇨🇳|Китай",
      "🇮🇳|Индия",
      "🇦🇺|Австралия",
      "🇪🇬|Египет",
      "🇿🇦|ЮАР",
      "🇲🇽|Мексика",
      "🇬🇷|Греция",
      "🇳🇴|Норвегия",
      "🇹🇷|Турция",
      "🇰🇷|Южная Корея",
      "🇦🇷|Аргентина",
      "🇵🇹|Португалия",
      "🇳🇿|Новая Зеландия",
      "🇹🇭|Таиланд",
    ]),
  },
  {
    id: "characters",
    name: "Персонажи",
    icon: "👤",
    cards: cards([
      "🧙|Мудрец",
      "🧑‍🚀|Космонавт",
      "🧑‍🍳|Шеф-повар",
      "🧑‍🎨|Художник",
      "🕵️|Детектив",
      "🧛|Ночной охотник",
      "🧚|Фея",
      "🧜|Морская жительница",
      "🧑‍🌾|Фермер",
      "🧑‍🔬|Учёный",
      "🦸|Герой",
      "🥷|Ниндзя",
      "🤖|Робот",
      "👻|Призрак",
      "🤠|Ковбой",
      "👩‍🚀|Звёздный пилот",
      "🧑‍🚒|Спасатель",
      "🧑‍🏫|Учитель",
      "🎭|Актёр",
      "🧑‍🎤|Музыкант",
      "🧑‍✈️|Пилот",
      "🧝|Эльф",
      "🧞|Джинн",
      "🧟|Зомби",
    ]),
  },
  { id: "dota2", name: "Dota 2", icon: "⚔️", cards: dotaCards },
];
const rooms = new Map<string, Room>();
const makeCode = () => {
  let v = "";
  do v = Math.random().toString(36).slice(2, 7).toUpperCase();
  while (rooms.has(v));
  return v;
};
const validToken = (v: unknown) =>
  typeof v === "string" && v.length >= 8 && v.length <= 120 ? v : "";
const validCode = (v: unknown) =>
  typeof v === "string" && /^[A-Z0-9]{5}$/.test(v.trim().toUpperCase())
    ? v.trim().toUpperCase()
    : "";
const validName = (v: unknown) =>
  typeof v === "string" && v.trim().length >= 2 && v.trim().length <= 20
    ? v.trim()
    : "";
const validText = (v: unknown) =>
  typeof v === "string" && v.trim() && v.trim().length <= 300 ? v.trim() : "";
const getTheme = (id: unknown) => themes.find((t) => t.id === id);
const publicState = (r: Room, token: string) => {
  const me = r.players.find((p) => p.token === token);
  const t = getTheme(r.themeId)!;
  const byId = new Map(t.cards.map((card) => [card.id, card]));
  const roomCards = r.cardIds.map((id) => byId.get(id)!);
  return {
    code: r.code,
    theme: { id: t.id, name: t.name, icon: t.icon, cards: roomCards },
    phase: r.phase,
    players: r.players.map((p) => ({
      token: p.token,
      nickname: p.nickname,
      ready: p.ready,
      connected: p.connected,
      ...(r.phase === "finished" ? { secret: p.secret } : {}),
    })),
    me: { token, nickname: me?.nickname, secret: me?.secret },
    turn: r.turn,
    rounds: r.rounds,
    winner: r.winner,
    lastEvent: r.lastEvent,
  };
};
const app = express();
app.use(cors());
app.get("/api/health", (_, res) => res.json({ status: "ok" }));
const http = createServer(app);
const io = new Server(http, { cors: { origin: "*" } });
const fail = (s: Socket, m: string) => s.emit("errorMessage", m);
const fields = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const auth = (s: Socket, t: unknown) => {
  const r = rooms.get(s.data.room as string),
    p = r?.players.find((x) => x.token === t);
  return r && p && p.socketId === s.id ? { r, p } : undefined;
};
const broadcast = (r: Room) =>
  r.players.forEach(
    (p) =>
      p.socketId && io.to(p.socketId).emit("state", publicState(r, p.token)),
  );
io.on("connection", (s) => {
  s.on("create", (raw: unknown) => {
    const { token, nickname, themeId } = fields(raw);
    const safeToken = validToken(token),
      name = validName(nickname),
      theme = getTheme(themeId);
    if (!safeToken || !name)
      return fail(s, "Имя или идентификатор игрока некорректны.");
    if (!theme) return fail(s, "Неизвестная тема.");
    const cardIds = (
      theme.id === "dota2" ? selectRandomCards(theme.cards, 24) : theme.cards
    ).map((card) => card.id);
    const r: Room = {
      code: makeCode(),
      themeId: theme.id,
      cardIds,
      players: [
        {
          token: safeToken,
          nickname: name,
          ready: false,
          connected: true,
          socketId: s.id,
        },
      ],
      phase: "waiting",
      rounds: [],
    };
    rooms.set(r.code, r);
    s.data.room = r.code;
    s.emit("created", { code: r.code });
    broadcast(r);
  });
  s.on("join", (raw: unknown) => {
    const { code, token, nickname } = fields(raw);
    const roomCode = validCode(code),
      safeToken = validToken(token),
      r = rooms.get(roomCode),
      name = validName(nickname);
    if (!roomCode || !r) return fail(s, "Комната не найдена.");
    if (!safeToken || !name)
      return fail(s, "Имя или идентификатор игрока некорректны.");
    let p = r.players.find((x) => x.token === safeToken);
    if (!p && r.players.length >= 2) return fail(s, "Комната заполнена.");
    if (!p) {
      p = { token: safeToken, nickname: name, ready: false, connected: true };
      r.players.push(p);
    }
    p.nickname = name;
    p.socketId = s.id;
    p.connected = true;
    s.data.room = r.code;
    if (r.players.length === 2 && r.phase === "waiting") r.phase = "selecting";
    broadcast(r);
  });
  s.on("select", (raw: unknown) => {
    const { token, cardId } = fields(raw);
    const x = auth(s, token);
    if (
      !x ||
      x.r.phase !== "selecting" ||
      typeof cardId !== "string" ||
      !x.r.cardIds.includes(cardId)
    )
      return fail(s, "Недопустимая карточка.");
    x.p.secret = cardId;
    x.p.ready = false;
    broadcast(x.r);
  });
  s.on("ready", (raw: unknown) => {
    const { token } = fields(raw);
    const x = auth(s, token);
    if (!x || x.r.phase !== "selecting" || !x.p.secret) return;
    x.p.ready = true;
    if (x.r.players.length === 2 && x.r.players.every((p) => p.ready)) {
      x.r.phase = "waiting_for_question";
      x.r.turn = x.r.players[0].token;
    }
    broadcast(x.r);
  });
  s.on("askQuestion", (raw: unknown) => {
    const { token, question } = fields(raw);
    const x = auth(s, token),
      q = validText(question);
    if (!x || x.r.phase !== "waiting_for_question" || x.r.turn !== token || !q)
      return fail(s, "Сейчас нельзя задать вопрос.");
    x.r.rounds.push({
      id: crypto.randomUUID(),
      question: q,
      questioner: x.p.token,
    });
    x.r.phase = "waiting_for_answer";
    broadcast(x.r);
  });
  s.on("answerQuestion", (raw: unknown) => {
    const { token, answer } = fields(raw);
    const x = auth(s, token);
    if (
      !x ||
      x.r.phase !== "waiting_for_answer" ||
      x.r.turn === token ||
      (answer !== "yes" && answer !== "no" && answer !== "unknown")
    )
      return fail(s, "Сейчас нельзя ответить.");
    const round = x.r.rounds.at(-1);
    if (!round || round.answer) return fail(s, "На этот вопрос уже ответили.");
    round.answer = answer;
    x.r.turn = x.p.token;
    x.r.phase = "waiting_for_question";
    broadcast(x.r);
  });
  s.on("guess", (raw: unknown) => {
    const { token, cardId } = fields(raw);
    const x = auth(s, token);
    if (
      !x ||
      x.r.phase !== "waiting_for_question" ||
      x.r.turn !== token ||
      typeof cardId !== "string" ||
      !x.r.cardIds.includes(cardId)
    )
      return fail(s, "Сейчас нельзя угадывать.");
    const o = x.r.players.find((p) => p.token !== token);
    if (!o) return;
    if (o.secret === cardId) {
      x.r.phase = "finished";
      x.r.winner = x.p.token;
      x.r.lastEvent = "Правильная догадка!";
    } else {
      x.r.lastEvent = "Не угадали! Ход переходит сопернику.";
      x.r.turn = o.token;
    }
    broadcast(x.r);
  });
  s.on("rematch", (raw: unknown) => {
    const { token } = fields(raw);
    const x = auth(s, token);
    if (!x || x.r.phase !== "finished") return;
    if (x.r.themeId === "dota2")
      x.r.cardIds = selectRandomCards(dotaCards, 24).map((card) => card.id);
    x.r.phase = "selecting";
    x.r.turn = undefined;
    x.r.winner = undefined;
    x.r.lastEvent = undefined;
    x.r.rounds = [];
    x.r.players.forEach((p) => {
      p.secret = undefined;
      p.ready = false;
    });
    broadcast(x.r);
  });
  s.on("disconnect", () => {
    const r = rooms.get(s.data.room),
      p = r?.players.find((x) => x.socketId === s.id);
    if (!r || !p) return;
    p.connected = false;
    p.socketId = undefined;
    broadcast(r);
    setTimeout(() => {
      if (r.players.every((q) => !q.connected)) rooms.delete(r.code);
    }, 120000);
  });
});
const dist = join(process.cwd(), "client", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_, res) => res.sendFile(join(dist, "index.html")));
}
const port = Number(process.env.PORT) || 3001;
http.listen(port, "0.0.0.0", () => console.log(`Server listening on ${port}`));
