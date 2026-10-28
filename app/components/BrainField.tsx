"use client";

import { FormEvent, useMemo, useState, useTransition, useEffect } from "react";
import { fitLayout, fieldSize, type PlacedNode } from "@/lib/layout";
import { TaskGraph } from "@/app/components/TaskGraph";
import { GroupBubble } from "@/app/components/GroupBubble";

export type Task = {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  createdAt: string;
};

type BrainFieldProps = {
  initialTasks: Task[];
};

/** Above this many tasks, same-domain tasks collapse into group bubbles. */
const GROUP_THRESHOLD = 12;

type MapNode = PlacedNode &
  ({ kind: "task"; task: Task } | { kind: "group"; label: string; tasks: Task[] });

type TaskNode = PlacedNode & { task: Task };

function byCreatedAt(a: Task, b: Task) {
  return a.createdAt.localeCompare(b.createdAt);
}

/** Lay out the main map: individual tasks, or group bubbles once there are many tasks. */
function buildMapNodes(tasks: Task[]): MapNode[] {
  // Oldest first, so adding a task never moves the ones already on screen
  const sorted = [...tasks].sort(byCreatedAt);

  if (sorted.length <= GROUP_THRESHOLD) {
    const placed = fitLayout(sorted.map((t) => ({ id: t.id, anchorKey: t.category })));
    return placed.map((p, i) => ({ ...p, kind: "task", task: sorted[i] }));
  }

  const byCategory = new Map<string, Task[]>();
  for (const task of sorted) {
    if (!task.category) continue;
    const list = byCategory.get(task.category) ?? [];
    list.push(task);
    byCategory.set(task.category, list);
  }

  // Groups need 2+ tasks; singletons and unlabelled tasks stay as plain cards.
  // Each entry sits at the position of its oldest task, keeping the order stable.
  type Entry = { kind: "task"; task: Task } | { kind: "group"; label: string; tasks: Task[] };
  const entries: Entry[] = [];
  const seenGroups = new Set<string>();
  for (const task of sorted) {
    const members = task.category ? byCategory.get(task.category)! : null;
    if (members && members.length >= 2) {
      if (seenGroups.has(task.category!)) continue;
      seenGroups.add(task.category!);
      entries.push({ kind: "group", label: task.category!, tasks: members });
    } else {
      entries.push({ kind: "task", task });
    }
  }

  const placed = fitLayout(
    entries.map((e) =>
      e.kind === "group"
        ? {
            id: `group:${e.label}`,
            anchorKey: e.label,
            // Bigger groups are bigger bubbles with thicker links: the main branches
            scale: Math.min(1.6, 1.15 + 0.06 * (e.tasks.length - 2)),
            weight: 1 + Math.min(e.tasks.length, 12) * 0.2,
          }
        : { id: e.task.id, anchorKey: e.task.category },
    ),
  );
  return placed.map((p, i) => ({ ...p, ...entries[i] }));
}

/** An expanded card is this many times its normal width/height. */
const EXPAND_WIDTH = 2;
const EXPAND_HEIGHT = 1.8;

/**
 * Offset, in units of the card's own size, that keeps an expanded card inside
 * the field (0–100%): it grows right/down by default and slides back only as
 * far as it has to.
 */
function expandShift(start: number, size: number, factor: number) {
  const grown = size * factor;
  const clamped = Math.max(1, Math.min(start, 99 - grown));
  return (clamped - start) / size;
}

type TaskCardProps = {
  task: Task;
  delay: number;
  isExpanded: boolean;
  /** How far to slide the expanded card (in card widths/heights) so it stays inside the field. */
  shiftX: number;
  shiftY: number;
  onExpand: () => void;
  onDelete: () => void;
};

function TaskCard({ task, delay, isExpanded, shiftX, shiftY, onExpand, onDelete }: TaskCardProps) {
  return (
    <article
      data-task-card
      onClick={(event) => {
        event.stopPropagation();
        onExpand();
      }}
      className={`task-card overflow-hidden border border-[var(--bubble-border)] ${isExpanded ? "bg-[var(--bubble-solid)]" : "bg-[var(--bubble)]"} px-2.5 py-1.5 sm:px-3 sm:py-2 ${!isExpanded ? "transition-transform duration-300 ease-out hover:scale-125 hover:z-40" : ""}`}
      style={{
        borderRadius: 2,
        animationDelay: `${delay}s`,
        width: isExpanded ? `${EXPAND_WIDTH * 100}%` : "100%",
        minHeight: isExpanded ? `${EXPAND_HEIGHT * 100}%` : "100%",
        left: isExpanded ? `${shiftX * 100}%` : undefined,
        top: isExpanded ? `${shiftY * 100}%` : undefined,
        zIndex: isExpanded ? 100 : 10,
        position: "relative",
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
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            className="rounded-sm border border-[var(--bubble-border)] bg-[var(--bubble)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:opacity-60"
          >
            Eject
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function BrainField({ initialTasks }: BrainFieldProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);

  const mapNodes = useMemo(() => buildMapNodes(tasks), [tasks]);

  const openGroup = useMemo(
    () =>
      expandedGroup
        ? mapNodes.find(
            (n): n is Extract<MapNode, { kind: "group" }> =>
              n.kind === "group" && n.label === expandedGroup,
          ) ?? null
        : null,
    [expandedGroup, mapNodes],
  );

  const groupTaskNodes = useMemo<TaskNode[]>(() => {
    if (!openGroup) return [];
    // One shared anchor: the group's tasks branch out from the middle of the panel
    // The group has the whole field to itself, so its cards can be much larger
    const n = openGroup.tasks.length;
    const scale = n <= 4 ? 2 : n <= 8 ? 1.6 : n <= 12 ? 1.35 : 1;
    const placed = fitLayout(
      openGroup.tasks.map((t) => ({ id: t.id, anchorKey: openGroup.label, scale })),
    );
    return placed.map((p, i) => ({ ...p, task: openGroup.tasks[i] }));
  }, [openGroup]);

  const size = useMemo(
    () => fieldSize(openGroup ? groupTaskNodes.length : mapNodes.length),
    [openGroup, groupTaskNodes.length, mapNodes.length],
  );

  // Close the panel if its group dissolves (e.g. after ejecting tasks)
  useEffect(() => {
    if (expandedGroup && !openGroup) setExpandedGroup(null);
  }, [expandedGroup, openGroup]);

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

  useEffect(() => {
    if (!expandedGroup) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // First Escape collapses an open card, the next closes the group
      if (expandedTaskId) setExpandedTaskId(null);
      else setExpandedGroup(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [expandedGroup, expandedTaskId]);


  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Content is required.");
      return;
    }

    setError(null);
    const optimisticId = `temp-${Date.now()}`;
    const optimistic: Task = {
      id: optimisticId,
      title: title.trim() || null,
      content: trimmed,
      category: null,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [optimistic, ...prev]);
    setTitle("");
    setContent("");
    setShowForm(false);
    setExpandedGroup(null);

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

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error("Failed to create task");

        const saved = (await res.json()) as Task;

        setTasks((prev) =>
          prev.map((task) =>
            task.id === optimisticId
              ? {
                  id: saved.id,
                  title: saved.title,
                  content: saved.content,
                  category: saved.category,
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
      const res = await fetch("/api/tasks", {
        method: "DELETE", 
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({id: taskId}),
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if(!res.ok){
        throw new Error("Failed to delete task");
      }

      setTasks((current) => current.filter((currentTask) => currentTask.id !== taskId), );
      setExpandedTaskId(null);

      
    } catch {

      setError("Could not delete task. Try again.")

    }
  }

  function renderTaskCard(task: Task, node: PlacedNode) {
    return (
      <TaskCard
        task={task}
        delay={node.delay}
        isExpanded={expandedTaskId === task.id}
        shiftX={expandShift(node.left, node.width, EXPAND_WIDTH)}
        shiftY={expandShift(node.top, node.height, EXPAND_HEIGHT)}
        onExpand={() => setExpandedTaskId(task.id)}
        onDelete={() => handleDelete(task.id)}
      />
    );
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

      {openGroup ? (
        // Inside a group: only its tasks are on the field, everything else is gone
        <div data-group-header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setExpandedGroup(null);
              setExpandedTaskId(null);
            }}
            className="rounded-sm border border-[var(--bubble-border)] bg-[var(--bubble)] px-3 py-1.5 text-sm text-[var(--ink)]"
          >
            ← All tasks
          </button>
          <h2 className="font-[family-name:var(--font-syne)] text-base font-bold tracking-wide text-[var(--ink)] sm:text-lg">
            {openGroup.label}
            <span className="ml-2 font-[family-name:var(--font-outfit)] text-xs font-normal text-[var(--ink-muted)]">
              {openGroup.tasks.length} tasks
            </span>
          </h2>
        </div>
      ) : null}

      <div
        className="relative mx-auto"
        style={{
          width: size.width,
          maxWidth: size.maxWidth,
          aspectRatio: "400 / 300",
        }}
        aria-label={openGroup ? `${openGroup.label} tasks` : "Suspended tasks connected by neurons"}
        role="region"
      >
        {openGroup ? (
          <div key={`group:${openGroup.label}`} data-group-view className="absolute inset-0">
            <TaskGraph
              idPrefix="group"
              nodes={groupTaskNodes}
              renderNode={(node) => renderTaskCard(node.task, node)}
              raisedId={expandedTaskId}
            />
          </div>
        ) : tasks.length === 0 ? (
          <p className="absolute left-1/2 top-1/2 w-[min(420px,70%)] -translate-x-1/2 -translate-y-1/2 text-center font-[family-name:var(--font-outfit)] text-[11px] leading-snug text-[var(--ink-muted)] sm:text-sm">
            Nothing dumped yet. Your thoughts will scatter here.
          </p>
        ) : (
          <div data-main-map className="absolute inset-0">
            <TaskGraph
              idPrefix="map"
              nodes={mapNodes}
              raisedId={expandedTaskId}
              renderNode={(node) =>
                node.kind === "group" ? (
                  <GroupBubble
                    label={node.label}
                    taskIds={node.tasks.map((t) => t.id)}
                    delay={node.delay}
                    onOpen={() => {
                      setExpandedTaskId(null);
                      setExpandedGroup(node.label);
                    }}
                  />
                ) : (
                  renderTaskCard(node.task, node)
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
