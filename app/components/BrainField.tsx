"use client";

import { FormEvent, useMemo, useState, useTransition, useEffect } from "react";

export type Task = {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
};

type PlacedTask = Task & {
  left: number;
  top: number;
  delay: number;
};

type BrainFieldProps = {
  initialTasks: Task[];
};

const CARD_WIDTH_PCT = 17;
const CARD_HEIGHT_PCT = 15;
const CARD_GAP_PCT = 1.5;

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function rectsOverlap(
  left1: number,
  top1: number,
  left2: number,
  top2: number,
) {
  const gap = CARD_GAP_PCT;
  return !(
    left1 + CARD_WIDTH_PCT + gap <= left2 ||
    left2 + CARD_WIDTH_PCT + gap <= left1 ||
    top1 + CARD_HEIGHT_PCT + gap <= top2 ||
    top2 + CARD_HEIGHT_PCT + gap <= top1
  );
}

function* candidateOffsets(maxRadius: number, step: number) {
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = -1;
  const max = Math.ceil(maxRadius / step);

  for (let i = 0; i < max * max; i++) {
    if (-max / 2 <= x && x <= max / 2 && -max / 2 <= y && y <= max / 2) {
      yield [x * step, y * step] as const;
    }
    if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
      const temp = dx;
      dx = -dy;
      dy = temp;
    }
    x += dx;
    y += dy;
  }
}

function placeTask(
  taskId: string,
  placed: PlacedTask[],
  index: number,
  totalTasks: number,
): Pick<PlacedTask, "left" | "top" | "delay"> {
  const seed = hashStringToNumber(taskId);
  const normSeed = (seed % 1000) / 1000;
  const delay = (seed % 10) * 0.06;

  const baseLeft = 6 + (78 - CARD_WIDTH_PCT) * normSeed;
  const baseTop = 8 + (74 - CARD_HEIGHT_PCT) * ((normSeed * 7) % 1);

  for (const [dx, dy] of candidateOffsets(28, 2.5)) {
    const left = baseLeft + dx;
    const top = baseTop + dy;

    if (
      left < 2 ||
      top < 2 ||
      left + CARD_WIDTH_PCT > 98 ||
      top + CARD_HEIGHT_PCT > 98
    ) {
      continue;
    }

    const overlaps = placed.some((p) => rectsOverlap(left, top, p.left, p.top));
    if (!overlaps) {
      return { left, top, delay };
    }
  }

  const cols = Math.ceil(Math.sqrt(Math.max(totalTasks, 1)));
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    left: Math.min(98 - CARD_WIDTH_PCT, 4 + col * (CARD_WIDTH_PCT + CARD_GAP_PCT)),
    top: Math.min(98 - CARD_HEIGHT_PCT, 4 + row * (CARD_HEIGHT_PCT + CARD_GAP_PCT)),
    delay,
  };
}

function withPlacements(tasks: Task[], prevPlaced: PlacedTask[] | null = null): PlacedTask[] {
  const placed: PlacedTask[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const prev = prevPlaced?.find((p) => p.id === task.id);
    if (prev) {
      const collision = placed.some((p) =>
        rectsOverlap(prev.left, prev.top, p.left, p.top),
      );
      if (!collision) {
        placed.push({ ...task, left: prev.left, top: prev.top, delay: prev.delay });
        continue;
      }
    }

    const placement = placeTask(task.id, placed, i, tasks.length);
    placed.push({ ...task, ...placement });
  }

  return placed;
}

function cardCenter(task: PlacedTask) {
  return {
    x: task.left + CARD_WIDTH_PCT / 2,
    y: task.top + CARD_HEIGHT_PCT / 2,
  };
}

type NeuronEdge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
};

/** Connect each card to its nearest neighbor; dedupe undirected edges. */
function buildNeuronEdges(tasks: PlacedTask[]): NeuronEdge[] {
  const edges = new Map<string, NeuronEdge>();

  for (const task of tasks) {
    const a = cardCenter(task);
    let nearest: PlacedTask | null = null;
    let best = Infinity;

    for (const other of tasks) {
      if (other.id === task.id) continue;
      const b = cardCenter(other);
      const dist = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (dist < best) {
        best = dist;
        nearest = other;
      }
    }

    if (!nearest) continue;

    const b = cardCenter(nearest);
    const key = [task.id, nearest.id].sort().join(":");
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Offset the curve perpendicular to the segment for an organic axon look
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(6, len * 0.18);
    const cx = mx - (dy / len) * bend;
    const cy = my + (dx / len) * bend;

    if (!edges.has(key)) {
      edges.set(key, {
        key,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        cx,
        cy,
      });
    }
  }

  return [...edges.values()];
}

function fieldSize(taskCount: number) {
  const count = Math.max(taskCount, 10);
  const widthVw = Math.min(96, 82 + (count - 10) * 1.1);
  const maxPx = Math.min(1280, 1040 + (count - 10) * 24);
  return {
    width: `${widthVw}vw`,
    maxWidth: `${maxPx}px`,
  };
}

export function BrainField({ initialTasks }: BrainFieldProps) {
  const [tasks, setTasks] = useState<PlacedTask[]>(() => withPlacements(initialTasks));
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const size = useMemo(() => fieldSize(tasks.length), [tasks.length]);
  const neurons = useMemo(() => buildNeuronEdges(tasks), [tasks]);

  useEffect(() => {
    if (!expandedTaskId) return;

    function handleOutsideClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-task-card]"))
        setExpandedTaskId(null);
    }
      document.addEventListener("mousedown", handleOutsideClick);
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
  }, [expandedTaskId]);


  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Content is required.");
      return;
    }

    setError(null);
    const optimisticId = `temp-${Date.now()}`;
    const placement = placeTask(optimisticId, tasks, tasks.length, tasks.length + 1);
    const optimistic: PlacedTask = {
      id: optimisticId,
      title: title.trim() || null,
      content: trimmed,
      createdAt: new Date().toISOString(),
      ...placement,
    };

    setTasks((prev) => [optimistic, ...prev]);
    setTitle("");
    setContent("");
    setShowForm(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: optimistic.title,
            content: optimistic.content,
          }),
        });

        if (!res.ok) throw new Error("Failed to create task");

        const saved = (await res.json()) as {
          id: string;
          title: string | null;
          content: string;
          createdAt: string;
        };

        setTasks((prev) =>
          prev.map((task) =>
            task.id === optimisticId
              ? {
                  ...task,
                  id: saved.id,
                  title: saved.title,
                  content: saved.content,
                  createdAt: saved.createdAt,
                }
              : task,
          ),
        );
      } catch {
        setTasks((prev) => prev.filter((task) => task.id !== optimisticId));
        setError("Could not save task. Try again.");
        setShowForm(true);
        setContent(trimmed);
        setTitle(optimistic.title ?? "");
      }
    });
  }

  async function handleDelete(taskId: string) {
    try{
      const res = await fetch("api/tasks/", {
        method: "DELETE", 
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({id: taskId}),
      });

      if(!res.ok){
        throw new Error("Failed to delete task");
      }

      setTasks((current) => current.filter((currentTask) => currentTask.id !== taskId), );
      setExpandedTaskId(null);

      
    } catch(e){

      setError("Could not delete task. Try again.")

    }
  }
    

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-sm border border-[var(--bubble-border)] bg-[var(--bubble)] px-5 py-2.5 font-[family-name:var(--font-outfit)] text-sm font-medium tracking-wide text-[var(--ink)] transition hover:bg-[rgba(180,205,235,0.24)]"
          >
            + Add task
          </button>
        ) : (
          <form
            onSubmit={handleAdd}
            className="flex w-full max-w-md flex-col gap-2 rounded-sm border border-[var(--bubble-border)] bg-[rgba(10,18,32,0.72)] p-4"
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="rounded-sm border border-[var(--bubble-border)] bg-transparent px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--brain-stroke)]"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              required
              rows={3}
              className="resize-none rounded-sm border border-[var(--bubble-border)] bg-transparent px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--brain-stroke)]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="px-3 py-2 text-sm text-[var(--ink-muted)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-sm border border-[var(--bubble-border)] bg-[var(--bubble)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
              >
                {isPending ? "Saving…" : "Dump it"}
              </button>
            </div>
          </form>
        )}
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="relative mx-auto"
        style={{
          width: size.width,
          maxWidth: size.maxWidth,
          aspectRatio: "400 / 300",
        }}
        aria-label="Suspended tasks connected by neurons"
        role="region"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="neuron-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(140,180,220,0.15)" />
              <stop offset="50%" stopColor="rgba(170,200,235,0.55)" />
              <stop offset="100%" stopColor="rgba(140,180,220,0.15)" />
            </linearGradient>
          </defs>

          {neurons.map((edge) => (
            <g key={edge.key} className="neuron-link">
              <path
                d={`M ${edge.x1} ${edge.y1} Q ${edge.cx} ${edge.cy} ${edge.x2} ${edge.y2}`}
                fill="none"
                stroke="url(#neuron-stroke)"
                strokeWidth="0.35"
                strokeLinecap="round"
              />
              
              <circle
                cx={edge.x1}
                cy={edge.y1}
                r="0.35"
                fill="rgba(170,200,235,0.45)"
              />
              <circle
                cx={edge.x2}
                cy={edge.y2}
                r="0.35"
                fill="rgba(170,200,235,0.45)"
              />
            </g>
          ))}
        </svg>

        <div className="absolute inset-0">
          {tasks.length === 0 ? (
            <p className="absolute left-1/2 top-1/2 w-[min(420px,70%)] -translate-x-1/2 -translate-y-1/2 text-center font-[family-name:var(--font-outfit)] text-[11px] leading-snug text-[var(--ink-muted)] sm:text-sm">
              Nothing dumped yet. Your thoughts will scatter here.
            </p>
          ) : (
            tasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
             return(
              <div
                key={task.id}
                className="task-float absolute"
                style={{
                  left: `${task.left}%`,
                  top: `${task.top}%`,
                  width: `${CARD_WIDTH_PCT}%`,
                  height: `${CARD_HEIGHT_PCT}%`,
                  animationDelay: `${task.delay + 0.55}s`,
                }}
              >
                <article
                  data-task-card 
                  onClick={(event) => {
                    event.stopPropagation(); 
                    setExpandedTaskId(task.id); 
                  }}
                  className={`task-card overflow-hidden border border-[var(--bubble-border)] ${isExpanded ? "bg-[var(--bubble-solid)]" : "bg-[var(--bubble)]"} px-2.5 py-1.5 sm:px-3 sm:py-2 ${!isExpanded ? "transition-transform duration-300 ease-out hover:scale-125 hover:z-40" : ""}`}
                  style={{
                    borderRadius: 2,
                    animationDelay: `${task.delay}s`,
                    width: isExpanded ? "200%" : "100%",
                    minHeight: isExpanded ? "180%" : "100%",
                    zIndex: isExpanded ? 100 : 10,
                  }}
                >
                  {task.title ? (
                    <h2 className="truncate font-[family-name:var(--font-outfit)] text-[10px] font-semibold tracking-wide text-[var(--ink)] sm:text-xs">
                      {task.title}
                    </h2>
                  ) : null}
                  <p className="mt-0.5 line-clamp-3 font-[family-name:var(--font-outfit)] text-[10px] leading-snug text-[var(--ink-muted)] sm:text-xs">
                    {task.content}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                  {isExpanded ? (
                    <button 
                      type = "button"
                      onClick = {(event) => {
                        event.stopPropagation();
                        handleDelete(task.id);
                      }}
                      className="rounded-sm border border-[var(--bubble-border)] bg-[var(--bubble)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
                    >
                      Eject 
                    </button>
                  ) : null}
                  </div>
                </article>
              </div>
            );
             })
          )}
        </div>
      </div>
    </div>
  );
}
