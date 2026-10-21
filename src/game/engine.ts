export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 640;

export type MessKind = "trash" | "box" | "spill" | "bottle" | "crumbs";
export type GameStatus = "ready" | "playing" | "won";

export interface GameInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
}

export interface HudState {
  status: GameStatus;
  elapsed: number;
  cleaned: number;
  total: number;
}

type ObstacleKind = "shelf" | "counter" | "fridge" | "crate" | "bins" | "plant";

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ObstacleKind;
  seed: number;
}

interface Mess {
  id: number;
  kind: MessKind;
  x: number;
  y: number;
  time: number;
  progress: number;
  seed: number;
}

interface Player {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  moving: boolean;
  step: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  spin: number;
  shape: "dot" | "confetti";
}

const TAU = Math.PI * 2;
const WALL = 34;
const PLAYER_HALF = 12;
const PLAYER_SPEED = 228;
const CLEAN_RADIUS = 64;
const PLAYER_START = { x: 480, y: 536 };
const DOOR_X = 420;
const DOOR_W = 120;

const CLEAN_TIME: Record<MessKind, number> = {
  trash: 0.85,
  box: 1.5,
  spill: 2,
  bottle: 0.65,
  crumbs: 1,
};

const OBSTACLES: Obstacle[] = [
  { x: 64, y: 116, w: 52, h: 320, kind: "shelf", seed: 1 },
  { x: 108, y: 50, w: 150, h: 60, kind: "crate", seed: 2 },
  { x: 398, y: 262, w: 168, h: 66, kind: "shelf", seed: 3 },
  { x: 814, y: 116, w: 86, h: 196, kind: "fridge", seed: 4 },
  { x: 814, y: 342, w: 86, h: 64, kind: "shelf", seed: 5 },
  { x: 690, y: 50, w: 118, h: 58, kind: "crate", seed: 6 },
  { x: 138, y: 468, w: 212, h: 70, kind: "counter", seed: 7 },
  { x: 790, y: 522, w: 96, h: 62, kind: "bins", seed: 8 },
  { x: 58, y: 500, w: 48, h: 48, kind: "plant", seed: 9 },
];

const PRODUCT_COLORS = [
  "#c2633a",
  "#3f7d6a",
  "#b98b2f",
  "#7a5ba6",
  "#3d6f9c",
  "#a94a4a",
  "#6c8a3f",
];

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function isBlockedPoint(x: number, y: number, pad: number) {
  for (const o of OBSTACLES) {
    if (
      x > o.x - pad &&
      x < o.x + o.w + pad &&
      y > o.y - pad &&
      y < o.y + o.h + pad
    ) {
      return true;
    }
  }
  return false;
}

function createMesses(): Mess[] {
  const kinds = shuffle<MessKind>([
    "trash",
    "trash",
    "trash",
    "trash",
    "box",
    "box",
    "spill",
    "spill",
    "bottle",
    "bottle",
    "crumbs",
    "crumbs",
  ]);
  const messes: Mess[] = [];
  const minX = WALL + 48;
  const maxX = WORLD_WIDTH - WALL - 48;
  const minY = WALL + 52;
  const maxY = WORLD_HEIGHT - WALL - 64;
  let attempts = 0;

  while (messes.length < kinds.length && attempts < 4000) {
    attempts += 1;
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);

    if (isBlockedPoint(x, y, 30)) continue;
    if (Math.hypot(x - PLAYER_START.x, y - PLAYER_START.y) < 120) continue;
    if (messes.some((m) => Math.hypot(m.x - x, m.y - y) < 78)) continue;

    const kind = kinds[messes.length];
    messes.push({
      id: messes.length,
      kind,
      x,
      y,
      time: CLEAN_TIME[kind],
      progress: 0,
      seed: Math.random() * 1000,
    });
  }

  return messes;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function paintRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string | CanvasGradient,
) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function paintCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function softShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  ctx.fillStyle = "rgba(45, 36, 22, 0.16)";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function drawRoom(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#26352e";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const floorX = WALL;
  const floorY = WALL;
  const floorW = WORLD_WIDTH - WALL * 2;
  const floorH = WORLD_HEIGHT - WALL * 2;

  ctx.fillStyle = "#ecd9b4";
  ctx.fillRect(floorX, floorY, floorW, floorH);

  const tile = 80;
  ctx.fillStyle = "rgba(168, 123, 66, 0.08)";
  for (let y = floorY; y < floorY + floorH; y += tile) {
    for (let x = floorX; x < floorX + floorW; x += tile) {
      const col = Math.round((x - floorX) / tile);
      const row = Math.round((y - floorY) / tile);
      if ((col + row) % 2 === 0) {
        ctx.fillRect(
          x,
          y,
          Math.min(tile, floorX + floorW - x),
          Math.min(tile, floorY + floorH - y),
        );
      }
    }
  }

  ctx.strokeStyle = "rgba(120, 86, 48, 0.09)";
  ctx.lineWidth = 1;
  for (let x = floorX; x <= floorX + floorW; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, floorY + floorH);
    ctx.stroke();
  }
  for (let y = floorY; y <= floorY + floorH; y += tile) {
    ctx.beginPath();
    ctx.moveTo(floorX, y);
    ctx.lineTo(floorX + floorW, y);
    ctx.stroke();
  }

  for (let i = 0; i < 26; i += 1) {
    const x = floorX + ((i * 173) % floorW);
    const y = floorY + ((i * 97) % floorH);
    ctx.strokeStyle = "rgba(130, 94, 54, 0.08)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26 + (i % 5) * 7, y + 1);
    ctx.stroke();
  }

  const doorGlow = ctx.createLinearGradient(
    0,
    WORLD_HEIGHT - WALL - 80,
    0,
    WORLD_HEIGHT - WALL,
  );
  doorGlow.addColorStop(0, "rgba(255, 244, 208, 0)");
  doorGlow.addColorStop(1, "rgba(255, 244, 208, 0.22)");
  ctx.fillStyle = doorGlow;
  ctx.fillRect(DOOR_X - 10, WORLD_HEIGHT - WALL - 80, DOOR_W + 20, 80);

  ctx.strokeStyle = "rgba(244, 231, 203, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL - 3, WALL - 3, floorW + 6, floorH + 6);

  ctx.fillStyle = "#15201c";
  ctx.fillRect(DOOR_X, WORLD_HEIGHT - WALL, DOOR_W, WALL);
  ctx.fillStyle = "rgba(158, 211, 230, 0.2)";
  paintRound(
    ctx,
    DOOR_X + 7,
    WORLD_HEIGHT - WALL + 5,
    50,
    WALL - 10,
    3,
    "rgba(158, 211, 230, 0.22)",
  );
  paintRound(
    ctx,
    DOOR_X + 63,
    WORLD_HEIGHT - WALL + 5,
    50,
    WALL - 10,
    3,
    "rgba(158, 211, 230, 0.18)",
  );
  ctx.fillStyle = "rgba(244, 231, 203, 0.55)";
  ctx.fillRect(DOOR_X + 57, WORLD_HEIGHT - WALL + 13, 2, 8);
  ctx.fillRect(DOOR_X + 61, WORLD_HEIGHT - WALL + 13, 2, 8);

  ctx.save();
  ctx.translate(480, 572);
  paintRound(ctx, -58, -18, 116, 36, 9, "#b4553f");
  paintRound(ctx, -52, -13, 104, 26, 6, "#c86a4f");
  ctx.strokeStyle = "rgba(255, 240, 214, 0.5)";
  ctx.lineWidth = 2;
  for (let i = -40; i <= 40; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, -10);
    ctx.lineTo(i, 10);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 246, 225, 0.9)";
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WELCOME", 0, 1);
  ctx.restore();

  paintRound(ctx, 352, 4, 256, 27, 8, "#f6ecd4");
  ctx.strokeStyle = "#1a2a23";
  ctx.lineWidth = 2;
  roundRect(ctx, 352, 4, 256, 27, 8);
  ctx.stroke();
  ctx.fillStyle = "#1f3d33";
  ctx.font = "700 16px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OWSHOP", 480, 18);

  ctx.save();
  ctx.translate(724, 17);
  paintCircle(ctx, 0, 0, 10, "#f6ecd4");
  ctx.strokeStyle = "#1a2a23";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "#1f3d33";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -5);
  ctx.moveTo(0, 0);
  ctx.lineTo(3.5, 2.5);
  ctx.stroke();
  ctx.restore();

  paintRound(ctx, 560, WORLD_HEIGHT - WALL + 6, 64, 21, 5, "#f6ecd4");
  ctx.fillStyle = "#2f8f83";
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OPEN", 592, WORLD_HEIGHT - WALL + 17);
}

function drawShelf(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  softShadow(ctx, x + w / 2, y + h - 2, w * 0.56, 10);
  paintRound(ctx, x, y, w, h, 7, "#5d3a22");
  paintRound(ctx, x + 4, y + 4, w - 8, h - 8, 5, "#8a5a33");
  paintRound(ctx, x + 8, y + 8, w - 16, h - 16, 4, "#3b2818");

  const cell = 26;
  const cols = Math.max(1, Math.floor((w - 16) / cell));
  const rows = Math.max(1, Math.floor((h - 16) / cell));
  const padX = (w - 16 - cols * cell) / 2 + 8;
  const padY = (h - 16 - rows * cell) / 2 + 8;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = x + padX + col * cell + 4;
      const py = y + padY + row * cell + 3;
      const color =
        PRODUCT_COLORS[(o.seed + row * 3 + col * 5) % PRODUCT_COLORS.length];
      paintRound(ctx, px, py, 18, 20, 3, color);
      paintRound(ctx, px + 3, py + 3, 12, 5, 2, "rgba(255,255,255,0.3)");
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(px + 3, py + 14, 12, 4);
    }
  }
}

function drawCounter(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  softShadow(ctx, x + w / 2, y + h - 2, w * 0.54, 10);
  paintRound(ctx, x, y, w, h, 8, "#6b4527");
  paintRound(ctx, x + 5, y + 5, w - 10, h - 10, 5, "#d9bb8d");
  ctx.fillStyle = "rgba(110, 75, 40, 0.24)";
  ctx.fillRect(x + 5, y + h - 18, w - 10, 4);

  const rx = x + w - 70;
  const ry = y + 11;
  paintRound(ctx, rx, ry, 50, 36, 6, "#37413c");
  paintRound(ctx, rx + 6, ry + 6, 30, 15, 2, "#a7dcc3");
  ctx.fillStyle = "rgba(47, 143, 131, 0.6)";
  ctx.fillRect(rx + 9, ry + 9, 20, 2);
  ctx.fillRect(rx + 9, ry + 13, 13, 2);
  ctx.fillStyle = "rgba(246, 236, 212, 0.55)";
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(rx + 10 + i * 8, ry + 27, 2, 0, TAU);
    ctx.fill();
  }

  paintCircle(ctx, x + 30, y + 25, 8, "#f5ecdc");
  paintCircle(ctx, x + 30, y + 25, 5, "#7a4a2c");
  ctx.strokeStyle = "#f5ecdc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + 39, y + 25, 4, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  paintCircle(ctx, x + 72, y + 27, 7, "#b9683f");
  paintCircle(ctx, x + 72, y + 25, 8, "#3f7d53");
  paintCircle(ctx, x + 68, y + 22, 4, "#4f9465");
  paintCircle(ctx, x + 76, y + 22, 4, "#4f9465");
}

function drawFridge(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  softShadow(ctx, x + w / 2, y + h - 2, w * 0.56, 10);
  paintRound(ctx, x, y, w, h, 8, "#c5d2cc");
  paintRound(ctx, x + 4, y + 4, w - 8, h - 8, 6, "#f1f7f3");

  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, "rgba(190, 227, 238, 0.95)");
  glass.addColorStop(0.5, "rgba(132, 187, 208, 0.85)");
  glass.addColorStop(1, "rgba(176, 218, 232, 0.95)");
  paintRound(ctx, x + 10, y + 10, w - 20, h - 20, 4, glass);

  ctx.strokeStyle = "rgba(80, 122, 138, 0.35)";
  ctx.lineWidth = 1;
  for (let sy = y + 46; sy < y + h - 14; sy += 42) {
    ctx.beginPath();
    ctx.moveTo(x + 11, sy);
    ctx.lineTo(x + w - 11, sy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 11);
  ctx.lineTo(x + w / 2, y + h - 11);
  ctx.stroke();

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      const px = x + 17 + col * (w / 2 - 4);
      const py = y + 32 + row * 40;
      const color =
        PRODUCT_COLORS[(o.seed + row * 2 + col * 3) % PRODUCT_COLORS.length];
      paintRound(ctx, px, py, 14, 16, 3, color);
      paintRound(ctx, px + 3, py + 3, 8, 3, 1, "rgba(255,255,255,0.4)");
    }
  }

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + h - 30);
  ctx.lineTo(x + w - 26, y + 22);
  ctx.stroke();

  ctx.fillStyle = "#8fa39a";
  paintRound(ctx, x + w - 8, y + h / 2 - 20, 4, 40, 2, "#8fa39a");
}

function drawCrate(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  softShadow(ctx, x + w / 2, y + h - 2, w * 0.55, 9);
  paintRound(ctx, x, y, w, h, 6, "#9c6a3b");
  paintRound(ctx, x + 4, y + 4, w - 8, h - 8, 4, "#c08c55");
  ctx.strokeStyle = "rgba(105, 68, 33, 0.5)";
  ctx.lineWidth = 1.5;
  for (let lx = x + 12; lx < x + w - 6; lx += 22) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 6);
    ctx.lineTo(lx, y + h - 6);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(238, 218, 174, 0.85)";
  ctx.fillRect(x + 6, y + h / 2 - 5, w - 12, 10);
  ctx.fillRect(x + w / 2 - 5, y + 6, 10, h - 12);
  paintRound(ctx, x + w / 2 - 22, y + h / 2 - 11, 44, 22, 3, "#f4efdf");
  ctx.fillStyle = "#5d3a22";
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OWSHOP", x + w / 2, y + h / 2);
}

function drawBins(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  softShadow(ctx, x + w / 2, y + h - 2, w * 0.55, 8);
  const bins = [
    { bx: x + 4, color: "#3f7d53", lid: "#59a06c" },
    { bx: x + 52, color: "#3d6f8c", lid: "#5a91ad" },
  ];
  for (const bin of bins) {
    paintRound(ctx, bin.bx, y + 10, 40, 46, 7, bin.color);
    paintRound(ctx, bin.bx - 2, y + 8, 44, 9, 4, bin.lid);
    paintRound(ctx, bin.bx + 15, y + 4, 10, 6, 2, "#e8dfc8");
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(bin.bx + 20, y + 36, 8, 0.4, TAU - 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bin.bx + 25, y + 27);
    ctx.lineTo(bin.bx + 29, y + 29);
    ctx.lineTo(bin.bx + 26, y + 32);
    ctx.stroke();
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const { x, y, w, h } = o;
  const cx = x + w / 2;
  softShadow(ctx, cx, y + h - 3, 20, 8);
  paintRound(ctx, cx - 13, y + h - 26, 26, 24, 6, "#b9683f");
  paintRound(ctx, cx - 15, y + h - 28, 30, 7, 3, "#cf8355");
  const leafColors = ["#3f7d53", "#4f9465", "#326a45"];
  for (let i = 0; i < 7; i += 1) {
    ctx.save();
    ctx.translate(cx, y + h - 28);
    ctx.rotate((i / 7) * TAU + o.seed);
    ctx.fillStyle = leafColors[i % leafColors.length];
    ctx.beginPath();
    ctx.ellipse(0, -13, 5.5, 13, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  paintCircle(ctx, cx, y + h - 30, 4, "#2b5c3a");
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  switch (o.kind) {
    case "shelf":
      drawShelf(ctx, o);
      break;
    case "counter":
      drawCounter(ctx, o);
      break;
    case "fridge":
      drawFridge(ctx, o);
      break;
    case "crate":
      drawCrate(ctx, o);
      break;
    case "bins":
      drawBins(ctx, o);
      break;
    case "plant":
      drawPlant(ctx, o);
      break;
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  clock: number,
  cleaning: boolean,
) {
  const swing = p.moving ? Math.sin(p.step) * 3 : 0;
  const bob = p.moving
    ? Math.abs(Math.sin(p.step)) * 1.5
    : Math.sin(clock * 2) * 0.4;
  const x = p.x;
  const y = p.y - bob;

  ctx.fillStyle = "rgba(34, 28, 18, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, p.y + 14, 15, 5.5, 0, 0, TAU);
  ctx.fill();

  paintRound(ctx, x - 8, y + 1 + swing, 6, 12, 3, "#2c3d36");
  paintRound(ctx, x + 2, y + 1 - swing, 6, 12, 3, "#2c3d36");

  paintRound(ctx, x - 12, y - 14, 24, 26, 10, "#2f8f83");
  paintRound(ctx, x - 8, y - 9, 16, 19, 6, "#f4ecd8");
  ctx.strokeStyle = "rgba(47, 143, 131, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 1);
  ctx.lineTo(x + 5, y + 1);
  ctx.stroke();

  paintCircle(ctx, x - 13, y - 4, 4, "#efc29b");
  paintCircle(ctx, x + 13, y - 4, 4, "#efc29b");

  paintCircle(ctx, x, y - 23, 10, "#f2c39b");
  ctx.strokeStyle = "#3a2a22";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y - 23, 8.5, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();

  ctx.fillStyle = "#1f6f66";
  ctx.beginPath();
  ctx.arc(x, y - 24, 9.6, Math.PI, TAU);
  ctx.closePath();
  ctx.fill();
  paintRound(ctx, x - 9, y - 26, 18, 3.5, 1.8, "#185c55");

  if (p.facingY > -0.55) {
    const offset = p.facingX * 2;
    paintCircle(ctx, x - 3.5 + offset, y - 21.5, 1.3, "#2a211b");
    paintCircle(ctx, x + 3.5 + offset, y - 21.5, 1.3, "#2a211b");
  }

  if (cleaning) {
    ctx.save();
    ctx.translate(x + 11, y - 3);
    ctx.rotate(-0.5 + Math.sin(clock * 12) * 0.1);
    ctx.strokeStyle = "#8a6841";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, 14);
    ctx.stroke();
    paintRound(ctx, 13, 11, 12, 8, 2, "#eadfb8");
    ctx.restore();
  }
}

function drawMess(
  ctx: CanvasRenderingContext2D,
  m: Mess,
  clock: number,
) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.fillStyle = "rgba(70, 50, 20, 0.14)";
  ctx.beginPath();
  ctx.ellipse(0, 4, 17, 8, 0, 0, TAU);
  ctx.fill();
  ctx.rotate(Math.sin(clock * 1.8 + m.seed) * 0.03);

  if (m.kind === "trash") {
    ctx.fillStyle = "#f8f3e4";
    ctx.beginPath();
    ctx.arc(-4, 0, 9, 0, TAU);
    ctx.arc(4, -2, 8, 0, TAU);
    ctx.arc(0, 4, 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 110, 90, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -1);
    ctx.lineTo(-2, 3);
    ctx.moveTo(1, -6);
    ctx.lineTo(5, 1);
    ctx.moveTo(-2, 7);
    ctx.lineTo(3, 8);
    ctx.stroke();
  } else if (m.kind === "box") {
    ctx.rotate(0.12 + (m.seed % 10) * 0.02);
    paintRound(ctx, -14, -11, 28, 22, 3, "#bb864f");
    ctx.strokeStyle = "rgba(105, 68, 33, 0.55)";
    ctx.lineWidth = 1.4;
    roundRect(ctx, -14, -11, 28, 22, 3);
    ctx.stroke();
    ctx.fillStyle = "rgba(238, 218, 174, 0.9)";
    ctx.fillRect(-14, -4, 28, 7);
    ctx.fillRect(-3, -11, 6, 22);
    ctx.fillStyle = "#6c4527";
    ctx.font = "700 6px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("OW", 0, 0);
  } else if (m.kind === "spill") {
    ctx.fillStyle = "rgba(150, 92, 38, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 11, 0.2, 0, TAU);
    ctx.ellipse(-12, 5, 8, 6, -0.3, 0, TAU);
    ctx.ellipse(13, 4, 7, 5, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(94, 55, 20, 0.32)";
    ctx.beginPath();
    ctx.ellipse(-2, 1, 10, 6, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.beginPath();
    ctx.ellipse(-7, -4, 4, 2, -0.5, 0, TAU);
    ctx.fill();
  } else if (m.kind === "bottle") {
    ctx.rotate(0.6 + (m.seed % 7) * 0.08);
    paintRound(ctx, -6, -13, 12, 26, 5, "#4f8f5a");
    paintRound(ctx, -3, -18, 6, 7, 2, "#3c7449");
    paintRound(ctx, -3.5, -20, 7, 3, 1.5, "#d9c07a");
    paintRound(ctx, -4.5, -4, 9, 9, 2, "#f2ead2");
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(-3, -11, 2, 16);
  } else {
    for (let i = 0; i < 8; i += 1) {
      const angle = (m.seed % 10) + i * 2.399;
      const radius = 4 + (i % 3) * 4;
      paintCircle(
        ctx,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.7,
        1.8 + (i % 3) * 0.5,
        i % 2 === 0 ? "#c99a5b" : "#e0b273",
      );
    }
  }

  ctx.restore();
}

export class ShopEngine {
  input: GameInput = {
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
  };

  onWin: ((elapsed: number) => void) | null = null;

  private status: GameStatus = "ready";
  private player: Player = {
    ...PLAYER_START,
    facingX: 0,
    facingY: -1,
    moving: false,
    step: 0,
  };
  private messes: Mess[] = [];
  private particles: Particle[] = [];
  private cleaned = 0;
  private elapsed = 0;
  private clock = 0;
  private activeTarget: Mess | null = null;

  constructor() {
    this.messes = createMesses();
  }

  start() {
    if (this.status === "ready") {
      this.status = "playing";
    }
  }

  restart() {
    this.player = {
      ...PLAYER_START,
      facingX: 0,
      facingY: -1,
      moving: false,
      step: 0,
    };
    this.messes = createMesses();
    this.particles = [];
    this.cleaned = 0;
    this.elapsed = 0;
    this.clock = 0;
    this.activeTarget = null;
    this.status = "playing";
  }

  getHud(): HudState {
    return {
      status: this.status,
      elapsed: this.elapsed,
      cleaned: this.cleaned,
      total: this.messes.length,
    };
  }

  update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.clock += dt;

    if (this.status === "playing") {
      this.elapsed += dt;
      this.movePlayer(dt);
      this.clean(dt);
    }

    this.updateParticles(dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawRoom(ctx);

    for (const m of this.messes) {
      if (m.progress < 1) drawMess(ctx, m, this.clock);
    }

    const drawables: { foot: number; draw: () => void }[] = OBSTACLES.map(
      (o) => ({
        foot: o.y + o.h,
        draw: () => drawObstacle(ctx, o),
      }),
    );

    drawables.push({
      foot: this.player.y + 14,
      draw: () =>
        drawPlayer(
          ctx,
          this.player,
          this.clock,
          this.input.action && this.activeTarget !== null,
        ),
    });

    drawables.sort((a, b) => a.foot - b.foot);
    for (const item of drawables) item.draw();

    this.drawParticles(ctx);
    this.drawVignette(ctx);
    this.drawTarget(ctx);
  }

  private movePlayer(dt: number) {
    const { input, player } = this;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const magnitude = Math.hypot(dx, dy);

    if (magnitude > 0) {
      dx /= magnitude;
      dy /= magnitude;
      player.moving = true;
      player.facingX = dx;
      player.facingY = dy;
      player.step += dt * 11;
    } else {
      player.moving = false;
    }

    if (dx !== 0) {
      const nextX = player.x + dx * PLAYER_SPEED * dt;
      if (!this.blocked(nextX, player.y)) player.x = nextX;
    }
    if (dy !== 0) {
      const nextY = player.y + dy * PLAYER_SPEED * dt;
      if (!this.blocked(player.x, nextY)) player.y = nextY;
    }
  }

  private blocked(x: number, y: number) {
    const left = x - PLAYER_HALF;
    const right = x + PLAYER_HALF;
    const top = y - PLAYER_HALF;
    const bottom = y + PLAYER_HALF;

    if (
      left < WALL ||
      right > WORLD_WIDTH - WALL ||
      top < WALL ||
      bottom > WORLD_HEIGHT - WALL
    ) {
      return true;
    }

    for (const o of OBSTACLES) {
      if (
        right > o.x &&
        left < o.x + o.w &&
        bottom > o.y &&
        top < o.y + o.h
      ) {
        return true;
      }
    }

    return false;
  }

  private clean(dt: number) {
    const target = this.nearestMess();
    this.activeTarget = target;

    if (!target || !this.input.action) return;

    target.progress = Math.min(1, target.progress + dt / target.time);

    if (target.progress >= 1) {
      this.cleaned += 1;
      this.activeTarget = null;
      this.burst(target.x, target.y, 16, ["#f4d58d", "#8fd3c4", "#f8f2df"]);
      if (this.cleaned >= this.messes.length) {
        this.finish();
      }
    }
  }

  private nearestMess() {
    let bestDistance = CLEAN_RADIUS;
    let best: Mess | null = null;

    for (const m of this.messes) {
      if (m.progress >= 1) continue;
      const distance = Math.hypot(m.x - this.player.x, m.y - this.player.y);
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = m;
      }
    }

    return best;
  }

  private finish() {
    this.status = "won";
    this.activeTarget = null;
    const colors = [
      "#f4d58d",
      "#8fd3c4",
      "#f8f2df",
      "#d97706",
      "#3f7d6a",
      "#c2633a",
    ];
    for (let i = 0; i < 150; i += 1) {
      const life = 2.6 + Math.random() * 1.6;
      this.particles.push({
        x: Math.random() * WORLD_WIDTH,
        y: -Math.random() * WORLD_HEIGHT * 0.35,
        vx: (Math.random() - 0.5) * 60,
        vy: 70 + Math.random() * 120,
        gravity: 55,
        life,
        maxLife: life,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 9,
        shape: "confetti",
      });
    }
    this.onWin?.(this.elapsed);
  }

  private burst(x: number, y: number, count: number, colors: string[]) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 35 + Math.random() * 95;
      const life = 0.5 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        gravity: 130,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: 0,
        spin: 0,
        shape: "dot",
      });
    }
  }

  private updateParticles(dt: number) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 1 - 0.7 * dt;
      p.rot += p.spin * dt;
      return p.life > 0;
    });
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.fillStyle = p.color;
      if (p.shape === "confetti") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawVignette(ctx: CanvasRenderingContext2D) {
    const gradient = ctx.createRadialGradient(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_HEIGHT * 0.32,
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      WORLD_HEIGHT * 0.82,
    );
    gradient.addColorStop(0, "rgba(20, 20, 12, 0)");
    gradient.addColorStop(1, "rgba(20, 20, 12, 0.24)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  private drawTarget(ctx: CanvasRenderingContext2D) {
    if (this.status !== "playing") return;

    const target = this.nearestMess();
    if (!target) return;

    const pulse = 0.5 + Math.sin(this.clock * 5) * 0.5;
    ctx.save();
    ctx.translate(target.x, target.y);

    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -this.clock * 16;
    ctx.strokeStyle = `rgba(255, 248, 220, ${0.32 + pulse * 0.38})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    if (target.progress > 0) {
      ctx.strokeStyle = "rgba(20, 38, 32, 0.4)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = "#f0c264";
      ctx.beginPath();
      ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + TAU * target.progress);
      ctx.stroke();
    }

    const label = this.input.action ? "Cleaning" : "Hold to clean";
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    const labelWidth = ctx.measureText(label).width;
    const boxY = -54;
    paintRound(
      ctx,
      -labelWidth / 2 - 8,
      boxY,
      labelWidth + 16,
      20,
      10,
      "rgba(21, 32, 27, 0.84)",
    );
    ctx.fillStyle = "#fdf6e3";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, boxY + 10.5);

    ctx.restore();
  }
}
