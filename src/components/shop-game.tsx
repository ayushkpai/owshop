"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  ShopEngine,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameInput,
  type HudState,
} from "@/game/engine";

const BEST_KEY = "owshop-best-time";
const BEST_EVENT = "owshop-best-change";

const EMPTY_INPUT: GameInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  action: false,
};

const INITIAL_HUD: HudState = {
  status: "ready",
  elapsed: 0,
  cleaned: 0,
  total: 0,
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);
  return `${minutes}:${wholeSeconds.toString().padStart(2, "0")}.${tenths}`;
}

function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function subscribeBest(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(BEST_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BEST_EVENT, onChange);
  };
}

function getBestSnapshot() {
  if (typeof window === "undefined") return null;
  return readBest();
}

function getServerBestSnapshot() {
  return null;
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[72px] rounded-xl border border-[#1f6f66]/12 bg-white/60 px-2.5 py-1.5 text-right shadow-sm backdrop-blur">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p
        className={`font-mono text-sm font-semibold tabular-nums ${
          accent ? "text-[#1f6f66]" : "text-[#22302a]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-stone-300/80 bg-white/75 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-stone-700 shadow-sm">
      {children}
    </kbd>
  );
}

function PadButton({
  label,
  ariaLabel,
  input,
  setInput,
}: {
  label: string;
  ariaLabel: string;
  input: keyof GameInput;
  setInput: (key: keyof GameInput, value: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="grid size-14 touch-none select-none place-items-center rounded-2xl border border-white/15 bg-[#1a2822]/80 text-xl text-[#f4ecd8] shadow-lg shadow-black/20 transition active:scale-95 active:bg-[#2f8f83]"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        setInput(input, true);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        setInput(input, false);
      }}
      onPointerCancel={() => setInput(input, false)}
      onLostPointerCapture={() => setInput(input, false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

export default function ShopGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ShopEngine | null>(null);

  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [isRecord, setIsRecord] = useState(false);
  const best = useSyncExternalStore(
    subscribeBest,
    getBestSnapshot,
    getServerBestSnapshot,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const engine = new ShopEngine();
    engineRef.current = engine;
    engine.onWin = (time) => {
      setHud(engine.getHud());
      const previous = readBest();
      if (previous === null || time < previous) {
        setIsRecord(true);
        try {
          window.localStorage.setItem(BEST_KEY, String(time));
          window.dispatchEvent(new Event(BEST_EVENT));
        } catch {
          // The run still counts even if storage is unavailable.
        }
      } else {
        setIsRecord(false);
      }
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WORLD_WIDTH * dpr;
    canvas.height = WORLD_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      engine.update(dt);
      engine.draw(ctx);
      hudTimer += dt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        setHud(engine.getHud());
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
  }, []);

  const beginGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.start();
    setHud(engine.getHud());
    setIsRecord(false);
  }, []);

  const restartGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.restart();
    setHud(engine.getHud());
    setIsRecord(false);
  }, []);

  const setInput = useCallback(
    (key: keyof GameInput, value: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.input[key] = value;
      if (value && engine.getHud().status === "ready") {
        beginGame();
      }
    },
    [beginGame],
  );

  useEffect(() => {
    const keyMap: Record<string, keyof GameInput> = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      " ": "action",
      e: "action",
    };

    const handle = (event: KeyboardEvent, pressed: boolean) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("button, a, input, textarea, select, [contenteditable]")
      ) {
        return;
      }

      const mapped = keyMap[event.key.toLowerCase()];
      if (!mapped) return;

      event.preventDefault();
      if (event.repeat) return;
      setInput(mapped, pressed);
    };

    const onKeyDown = (event: KeyboardEvent) => handle(event, true);
    const onKeyUp = (event: KeyboardEvent) => handle(event, false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setInput]);

  useEffect(() => {
    const release = () => {
      const engine = engineRef.current;
      if (engine) engine.input = { ...EMPTY_INPUT };
    };
    const onVisibility = () => {
      if (document.hidden) release();
    };

    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const remaining = Math.max(0, hud.total - hud.cleaned);
  const percent = hud.total > 0 ? Math.round((hud.cleaned / hud.total) * 100) : 0;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#f3ead8] text-stone-800">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(47,143,131,0.18),transparent_42%),radial-gradient(circle_at_88%_2%,rgba(217,155,80,0.2),transparent_38%),radial-gradient(circle_at_50%_100%,rgba(47,143,131,0.12),transparent_48%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(31,111,102,0.35)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]"
      />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#1f6f66] text-xl font-semibold text-[#f7f1df] shadow-lg shadow-[#1f6f66]/25">
              O
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#1f6f66]">
                Owshop presents
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1d2a24] sm:text-3xl">
                Closing-time cleanup
              </h1>
            </div>
          </div>
          <div className="flex items-stretch gap-2">
            <Stat label="Time" value={formatTime(hud.elapsed)} />
            <Stat label="Left" value={String(remaining)} />
            <Stat label="Best" value={best === null ? "—" : formatTime(best)} accent />
          </div>
        </header>

        <div className="rounded-2xl border border-[#1f6f66]/15 bg-white/55 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3c4a43]">
            <span>Cleanliness</span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#1f6f66]/12"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Shop cleanliness"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2f8f83,#9bc25b)] transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[26px] border border-[#1d2a24]/10 bg-[#26352e] shadow-[0_30px_70px_-30px_rgba(29,42,36,0.65)]">
          <canvas
            ref={canvasRef}
            width={WORLD_WIDTH}
            height={WORLD_HEIGHT}
            role="img"
            aria-label="Top-down view of a messy corner shop. Move with WASD or the arrow keys and hold Space to clean."
            className="block h-auto w-full touch-none"
          />

          {hud.status === "ready" ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#16211c]/55 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-sm animate-[overlay-pop_240ms_ease-out] rounded-[26px] border border-white/40 bg-[#fbf5e6]/95 p-6 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] sm:max-w-md sm:p-7">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#1f6f66]">
                  Welcome back
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2a24] sm:text-[1.7rem]">
                  The shop is a wreck.
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-stone-600">
                  Boxes to the left, spills to the right. Pick up every last
                  piece before the doors open.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                  <div className="rounded-xl border border-[#1f6f66]/15 bg-white/70 px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Move
                    </p>
                    <p className="text-sm font-medium text-[#1d2a24]">
                      WASD / Arrows
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#1f6f66]/15 bg-white/70 px-3 py-2">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Clean
                    </p>
                    <p className="text-sm font-medium text-[#1d2a24]">
                      Hold Space / E
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={beginGame}
                  className="mt-6 w-full rounded-2xl bg-[#1f6f66] px-5 py-3 text-sm font-semibold text-[#f8f3e4] shadow-lg shadow-[#1f6f66]/30 transition hover:bg-[#185c55] active:scale-[0.99]"
                >
                  Open up shop
                </button>
              </div>
            </div>
          ) : null}

          {hud.status === "won" ? (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[#16211c]/60 p-4 backdrop-blur-[2px]">
              <div className="w-full max-w-sm animate-[overlay-pop_240ms_ease-out] rounded-[26px] border border-white/40 bg-[#fbf5e6]/95 p-6 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] sm:p-7">
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#1f6f66]">
                  Closed, spotless
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2a24]">
                  Every last crumb.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  You tidied all {hud.total} messes in{" "}
                  <span className="font-semibold text-[#1d2a24]">
                    {formatTime(hud.elapsed)}
                  </span>
                  .
                </p>
                <div className="mt-4 rounded-2xl border border-[#1f6f66]/12 bg-[#1f6f66]/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-600">Best time</span>
                    <span className="font-mono font-semibold text-[#1f6f66]">
                      {best === null ? "—" : formatTime(best)}
                    </span>
                  </div>
                  {isRecord ? (
                    <p className="mt-1 text-left text-xs font-medium text-[#1f6f66]">
                      New personal best.
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={restartGame}
                  className="mt-6 w-full rounded-2xl bg-[#1f6f66] px-5 py-3 text-sm font-semibold text-[#f8f3e4] shadow-lg shadow-[#1f6f66]/30 transition hover:bg-[#185c55] active:scale-[0.99]"
                >
                  Clean it again
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-stone-600">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5">
              <Key>WASD</Key>
              <span className="text-xs text-stone-500">or</span>
              <Key>Arrows</Key>
              <span>to move</span>
            </span>
            <span className="hidden h-4 w-px bg-stone-400/40 sm:block" />
            <span className="flex items-center gap-1.5">
              <Key>Space</Key>
              <span className="text-xs text-stone-500">or</span>
              <Key>E</Key>
              <span>to clean</span>
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1f6f66]/70">
            Tidy every last bit
          </span>
        </div>

        <div className="hidden touch-none items-center justify-between gap-6 pt-1 [@media(pointer:coarse)]:flex">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            <span />
            <PadButton
              label="↑"
              ariaLabel="Move up"
              input="up"
              setInput={setInput}
            />
            <span />
            <PadButton
              label="←"
              ariaLabel="Move left"
              input="left"
              setInput={setInput}
            />
            <span className="grid place-items-center">
              <span className="size-2 rounded-full bg-[#1f6f66]/25" />
            </span>
            <PadButton
              label="→"
              ariaLabel="Move right"
              input="right"
              setInput={setInput}
            />
            <span />
            <PadButton
              label="↓"
              ariaLabel="Move down"
              input="down"
              setInput={setInput}
            />
            <span />
          </div>

          <button
            type="button"
            aria-label="Hold to clean"
            className="grid size-24 touch-none select-none place-items-center rounded-full border border-white/20 bg-[#1f6f66] text-center text-[#f8f3e4] shadow-xl shadow-[#1f6f66]/30 transition active:scale-95 active:bg-[#185c55]"
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setInput("action", true);
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              setInput("action", false);
            }}
            onPointerCancel={() => setInput("action", false)}
            onLostPointerCapture={() => setInput("action", false)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="text-sm font-semibold leading-tight">
              Clean
              <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.18em] text-[#cfe7d8]">
                hold
              </span>
            </span>
          </button>
        </div>
      </div>
    </main>
  );
}
