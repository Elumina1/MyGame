import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './style.css';

type Card = { id: string; name: string; visual: string };
type Player = { token: string; nickname: string; ready: boolean; connected: boolean; secret?: string };
type Round = { id: string; question: string; questioner: string; answer?: 'yes' | 'no' | 'unknown' };
type State = { code: string; theme: { id: string; name: string; icon: string; cards: Card[] }; phase: string; players: Player[]; me: { token: string; nickname: string; secret?: string }; turn?: string; rounds: Round[]; winner?: string; lastEvent?: string };

const socket = io();
const token = (() => { let value = sessionStorage.getItem('guess-tab-token'); if (!value) { value = crypto.randomUUID(); sessionStorage.setItem('guess-tab-token', value); } localStorage.setItem('playerToken', value); return value; })();
const answerText = (answer: string) => ({ yes: 'ДА', no: 'НЕТ', unknown: 'НЕ ЗНАЮ' }[answer] ?? '');

function App() {
  const inviteCode = location.pathname.match(/^\/join\/([A-Za-z0-9]{5})$/)?.[1]?.toUpperCase();
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState(() => localStorage.getItem('guess-name') ?? '');
  const [roomCode, setRoomCode] = useState(inviteCode ?? localStorage.getItem('roomCode') ?? '');
  const [themeId, setThemeId] = useState('animals');
  const [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  const [confirmSelection, setConfirmSelection] = useState('');
  const [guessMode, setGuessMode] = useState(false);
  const [guess, setGuess] = useState('');
  const [question, setQuestion] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [sound, setSound] = useState(() => localStorage.getItem('guess-sound') !== 'off');
  const historyRef = useRef<HTMLDivElement>(null);
  const previousTurnRef = useRef<string | undefined>(undefined);

  const rejoin = () => { const savedRoom = inviteCode ?? sessionStorage.getItem('guess-active-room'); const savedName = localStorage.getItem('guess-name'); if (savedRoom && savedName) socket.emit('join', { code: savedRoom, token, nickname: savedName }); };
  useEffect(() => { socket.on('state', setState); socket.on('errorMessage', setError); socket.on('connect', rejoin); rejoin(); return () => { socket.off('state', setState); socket.off('errorMessage', setError); socket.off('connect', rejoin); }; }, []);
  useEffect(() => { if (state?.code) { localStorage.setItem('roomCode', state.code); sessionStorage.setItem('guess-active-room', state.code); } }, [state?.code]);
  useEffect(() => { if (state?.phase === 'selecting' && !state.me.secret) setSelection(''); if (state?.phase === 'finished') tone(sound, state.winner === token ? 660 : 240, 180); }, [state?.phase, state?.me.secret]);
  useEffect(() => { if (state?.turn === token && previousTurnRef.current && previousTurnRef.current !== token) tone(sound, 560, 100); previousTurnRef.current = state?.turn; }, [state?.turn, sound]);
  useEffect(() => { historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: 'smooth' }); }, [state?.rounds.length]);

  const toggleSound = () => setSound(current => { localStorage.setItem('guess-sound', current ? 'off' : 'on'); return !current; });
  const saveName = (value: string) => { setName(value); localStorage.setItem('guess-name', value); };
  const enterRoom = () => { const nickname = name.trim(); if (nickname.length < 2 || nickname.length > 20) return setError('Имя должно содержать от 2 до 20 символов.'); localStorage.setItem('guess-name', nickname); setError(''); if (inviteCode || roomCode) socket.emit('join', { code: inviteCode ?? roomCode, token, nickname }); else socket.emit('create', { token, nickname, themeId }); };
  const card = (id?: string) => state?.theme.cards.find(item => item.id === id);

  if (!state) return <main className="home"><div className="hero"><div className="mark">🦊</div><h1>Угадай кто?</h1><p>Задавайте вопросы, исключайте карточки и угадывайте персонажа соперника.</p><label>Ваше имя<input value={name} onChange={event => saveName(event.target.value)} maxLength={20} placeholder="Например, Alex" /></label>{!inviteCode && !roomCode && <><h3>Выберите тему</h3><div className="themes">{[['animals', '🐾', 'Животные'], ['food', '🍕', 'Еда'], ['transport', '🚗', 'Транспорт'], ['countries', '🌍', 'Страны'], ['characters', '👤', 'Персонажи']].map(([id, icon, label]) => <button className={themeId === id ? 'theme selected' : 'theme'} onClick={() => setThemeId(id)} key={id}>{icon}<span>{label}</span></button>)}</div><div className="joinline"><input value={roomCode} onChange={event => setRoomCode(event.target.value.toUpperCase())} placeholder="Код комнаты (или оставьте пустым)" maxLength={5} /></div></>}{inviteCode && <div className="inviteTitle">Присоединиться к комнате <b>{inviteCode}</b></div>}<button className="primary" onClick={enterRoom}>{inviteCode || roomCode ? 'Присоединиться' : 'Создать игру'}</button>{error && <div className="error">{error}</div>}</div></main>;

  const me = state.players.find(player => player.token === token)!;
  const opponent = state.players.find(player => player.token !== token);
  const myTurn = state.turn === token;
  const shareUrl = `${location.origin}/join/${state.code}`;
  const chooseCard = (cardId: string) => { if (state.phase === 'selecting') setConfirmSelection(cardId); else if (guessMode) setGuess(cardId); else setClosed(items => items.includes(cardId) ? items.filter(item => item !== cardId) : [...items, cardId]); };

  if (state.phase === 'finished') return <main><Header sound={sound} toggle={toggleSound} /><div className="result"><div className="trophy">{state.winner === token ? '🏆' : '💫'}</div><h1>{state.winner === token ? 'Вы победили!' : 'Соперник победил'}</h1><p>{state.lastEvent}</p><div className="secrets"><Secret title="Ваш персонаж" item={card(state.me.secret)} /><Secret title="Персонаж соперника" item={card(opponent?.secret)} /></div><button className="primary" onClick={() => { setClosed([]); setSelection(''); socket.emit('rematch', { token }); }}>Играть ещё раз</button><button className="secondary" onClick={() => { localStorage.removeItem('roomCode'); location.assign('/'); }}>На главную</button></div></main>;

  if (state.phase === 'waiting') return <main><Header sound={sound} toggle={toggleSound} /><div className="lobby card"><div className="eyebrow">КОМНАТА</div><h1>{state.code}</h1><p>Тема: {state.theme.icon} {state.theme.name}</p><div className="players">{state.players.map(player => <span key={player.token}>✓ {player.nickname}</span>)}<span className="muted">Ожидаем друга…</span></div><button onClick={() => navigator.clipboard?.writeText(state.code)}>Скопировать код</button><button className="secondary" onClick={() => navigator.clipboard?.writeText(shareUrl)}>Скопировать ссылку</button><small className="link">{shareUrl}</small></div></main>;

  const secret = state.me.secret ?? selection;
  const lastRound = state.rounds.at(-1);
  return <main><Header sound={sound} toggle={toggleSound} /><div className={`turn ${myTurn ? 'your' : ''}`}>{state.phase === 'selecting' ? 'Выберите секретного персонажа' : state.phase === 'waiting_for_answer' && myTurn ? 'Ожидаем ответ соперника…' : myTurn ? '🟢 ВАШ ХОД' : state.phase === 'waiting_for_answer' ? 'Соперник задаёт вопрос' : '⏳ ХОД СОПЕРНИКА'}<small>{state.theme.icon} {state.theme.name} · {me.nickname} VS {opponent?.nickname ?? '…'}{opponent && !opponent.connected ? ' · Соперник отключился' : ''}</small>{state.lastEvent && <small>{state.lastEvent}</small>}</div><section className="layout"><div className="main"><div className="grid">{state.theme.cards.map(item => <button aria-label={item.name} className={`animal ${closed.includes(item.id) ? 'closed' : ''} ${confirmSelection === item.id ? 'picked' : ''} ${guess === item.id ? 'guessing' : ''}`} key={item.id} onClick={() => chooseCard(item.id)}><span>{item.visual}</span><b>{item.name}</b>{closed.includes(item.id) && <em>× ИСКЛЮЧЕНО</em>}</button>)}</div>{state.phase === 'selecting' && <div className="bar">{secret ? <><span>Ваш персонаж: {card(secret)?.visual} {card(secret)?.name}</span><button onClick={() => socket.emit('ready', { token })}>{me.ready ? 'Готово ✓' : 'Готов'}</button></> : <span>Нажмите карточку, затем подтвердите выбор.</span>}</div>}{state.phase === 'waiting_for_question' && myTurn && <div className="ask bar"><label>Задайте вопрос<input value={question} onChange={event => setQuestion(event.target.value)} maxLength={300} placeholder="Ваш вопрос…" onKeyDown={event => { if (event.key === 'Enter' && question.trim()) { socket.emit('askQuestion', { token, question }); setQuestion(''); tone(sound, 440, 80); } }} /></label><button onClick={() => { if (question.trim()) { socket.emit('askQuestion', { token, question }); setQuestion(''); tone(sound, 440, 80); } }}>Задать вопрос</button><button className="guessBtn" onClick={() => { setGuessMode(true); setGuess(''); }}>🎯 Угадать</button></div>}{state.phase === 'waiting_for_answer' && !myTurn && <div className="answer bar"><b>Соперник спрашивает:</b><p>«{lastRound?.question}»</p>{(['yes', 'no', 'unknown'] as const).map(answer => <button key={answer} onClick={() => { socket.emit('answerQuestion', { token, answer }); tone(sound, 520, 100); }}>{answerText(answer)}</button>)}</div>}<Modal open={Boolean(confirmSelection)}><h2>Ваш персонаж: {card(confirmSelection)?.visual} {card(confirmSelection)?.name}</h2><button onClick={() => { setSelection(confirmSelection); socket.emit('select', { token, cardId: confirmSelection }); setConfirmSelection(''); }}>Выбрать</button><button className="secondary" onClick={() => setConfirmSelection('')}>Отмена</button></Modal>{guessMode && !guess && <div className="guessNotice" role="status"><b>🎯 Режим угадывания</b><span>Выберите персонажа на игровом поле.</span><button className="secondary" onClick={() => { setGuessMode(false); setGuess(''); }}>Отмена</button></div>}<Modal open={Boolean(guess)}><h2>{guess ? `Ваш ответ: ${card(guess)?.visual} ${card(guess)?.name}` : 'Выберите персонажа, которого хотите назвать'}</h2>{guess && <button onClick={() => { socket.emit('guess', { token, cardId: guess }); setGuessMode(false); setGuess(''); }}>Подтвердить</button>}<button className="secondary" onClick={() => { setGuessMode(false); setGuess(''); }}>Отмена</button></Modal></div><aside className="history"><h3>История раундов</h3><div className="rounds" ref={historyRef}>{state.rounds.length === 0 && <p className="muted">Здесь появятся вопросы и ответы.</p>}{state.rounds.map(round => <div className="round" key={round.id}><b>{round.questioner === token ? 'Вы' : opponent?.nickname ?? 'Соперник'}</b><p>«{round.question}»</p>{round.answer && <strong>{round.questioner === token ? opponent?.nickname ?? 'Соперник' : 'Вы'}: {answerText(round.answer)}</strong>}</div>)}</div></aside></section>{error && <div className="toast" role="alert">{error}</div>}</main>;
}

function Header({ sound, toggle }: { sound: boolean; toggle: () => void }) { return <header><div><b>🦊 Угадай кто?</b></div><button className="sound" aria-label="Переключить звук" onClick={toggle}>{sound ? '🔊' : '🔇'}</button></header>; }
function Secret({ title, item }: { title: string; item?: Card }) { return <div><small>{title}</small><strong>{item ? `${item.visual} ${item.name}` : '—'}</strong></div>; }
function Modal({ open, children }: { open: boolean; children: React.ReactNode }) { return open ? <div className="modal" role="dialog" aria-modal="true"><div className="card">{children}</div></div> : null; }
function tone(enabled: boolean, frequency: number, duration: number) { if (!enabled) return; try { const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = frequency; gain.gain.value = 0.035; oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration / 1000); } catch { /* audio is optional */ } }

createRoot(document.getElementById('root')!).render(<App />);
