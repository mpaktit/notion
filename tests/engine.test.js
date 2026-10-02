import { describe, it, expect } from 'vitest';
import { Game, GRID } from '../src/game/engine.js';

const run = (g, ticks) => { for (let i = 0; i < ticks && g.state === 'playing'; i++) g.tick(); };
const fresh = (o = {}) => { const g = new Game({ skipCountdown: true, seed: 42, ...o }); g.items = []; return g; };

describe('Game engine', () => {
  it('moves one cell per tick in the current direction', () => {
    const g = fresh();
    const h = { ...g.snake[0] };
    g.tick();
    expect(g.snake[0]).toEqual({ x: h.x + 1, y: h.y });
    expect(g.snake.length).toBe(4);
  });

  it('ignores 180° reversals and duplicate directions', () => {
    const g = fresh();
    expect(g.queueDir(-1, 0)).toBe(false);
    expect(g.queueDir(1, 0)).toBe(false);
    expect(g.queueDir(0, 1)).toBe(true);
    g.tick();
    expect(g.dir).toEqual({ x: 0, y: 1 });
  });

  it('dies on walls in endless mode', () => {
    const g = fresh();
    run(g, GRID + 2);
    expect(g.state).toBe('dead');
    expect(g.reason).toMatch(/wall/i);
  });

  it('wraps walls in zen mode', () => {
    const g = fresh({ mode: 'zen' });
    run(g, GRID + 2);
    expect(g.state).toBe('playing');
  });

  it('eats an apple, grows, scores and respawns food', () => {
    const g = fresh({ mode: 'classic' });
    const h = g.snake[0];
    g.items.push({ type: 'apple', x: h.x + 1, y: h.y, born: 0, ttl: Infinity });
    g.tick();
    expect(g.score).toBe(10);
    expect(g.food).toBe(1);
    expect(g.items.some((i) => i.type === 'apple')).toBe(true);
    g.tick();
    expect(g.snake.length).toBe(5);
  });

  it('builds combos within the combo window', () => {
    const g = fresh({ mode: 'classic' });
    for (let i = 0; i < 3; i++) {
      g.items = [];
      const h = g.snake[0];
      g.items.push({ type: 'apple', x: h.x + 1, y: h.y, born: 0, ttl: Infinity });
      g.tick(); g.time += 500;
    }
    expect(g.combo).toBe(3);
    expect(g.score).toBe(10 + 20 + 30);
  });

  it('dies when biting itself', () => {
    const g = fresh();
    g.grow = 6; run(g, 6);
    g.queueDir(0, 1); g.tick();
    g.queueDir(-1, 0); g.tick();
    g.queueDir(0, -1); g.tick();
    expect(g.state).toBe('dead');
    expect(g.reason).toMatch(/tail/i);
  });

  it('zen mode cuts the tail instead of dying', () => {
    const g = fresh({ mode: 'zen' });
    g.grow = 6; run(g, 6);
    g.queueDir(0, 1); g.tick(); g.queueDir(-1, 0); g.tick(); g.queueDir(0, -1); g.tick();
    expect(g.state).toBe('playing');
    expect(g.snake.length).toBeLessThan(10);
  });

  it('a shield absorbs one fatal hit', () => {
    const g = fresh({ species: 'basilisk' });
    expect(g.shield).toBe(1);
    run(g, GRID + 2);
    expect(g.state).toBe('playing');
    expect(g.shield).toBe(0);
  });

  it('revive restores play at most twice', () => {
    const g = fresh();
    run(g, GRID + 2);
    expect(g.canRevive()).toBe(true);
    g.revive(); expect(g.state).toBe('countdown');
    g.state = 'dead'; g.revive(); g.state = 'dead';
    expect(g.canRevive()).toBe(false);
  });

  it('abilities respect cooldown', () => {
    const g = fresh();
    expect(g.useAbility()).toBe(true);
    expect(g.effects.dash).toBeGreaterThan(0);
    expect(g.useAbility()).toBe(false);
    g.update(g.abilityMax + 1);
    expect(g.abilityCd).toBe(0);
  });

  it('solar flare destroys nearby hazards', () => {
    const g = fresh({ species: 'drake', sector: 'dunes' });
    const h = g.snake[0];
    g.obstacles.set(g.key(h.x + 2, h.y + 2), { temp: false });
    g.useAbility();
    expect(g.obstacles.has(g.key(h.x + 2, h.y + 2))).toBe(false);
  });

  it('is deterministic for the same seed', () => {
    const a = new Game({ seed: 7, demo: true }), b = new Game({ seed: 7, demo: true });
    for (let i = 0; i < 300; i++) { a.update(85); b.update(85); }
    expect(a.snake).toEqual(b.snake);
    expect(a.score).toBe(b.score);
  });

  it('demo AI survives a long time', () => {
    const g = new Game({ seed: 3, demo: true });
    for (let i = 0; i < 400 && g.state === 'playing'; i++) g.update(85);
    expect(g.food).toBeGreaterThan(5);
  });

  it('blitz ends when time runs out', () => {
    const g = fresh({ mode: 'blitz' });
    g.update(91000);
    expect(g.state).toBe('over');
  });

  it('black hole sector kills on contact', () => {
    const g = fresh({ sector: 'horizon' });
    expect(g.hole.size).toBe(4);
    const [k] = g.hole; const hx = k % GRID, hy = (k / GRID) | 0;
    g.snake = [{ x: hx - 1, y: hy }, { x: hx - 2, y: hy }, { x: hx - 3, y: hy }];
    g.dir = { x: 1, y: 0 };
    g.tick();
    expect(g.state).toBe('dead');
  });
});
