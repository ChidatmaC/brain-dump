import { hashStringToNumber, round } from "@/lib/layout";

type GroupBubbleProps = {
  label: string;
  /** Task ids in the group; one twig is drawn per task. */
  taskIds: string[];
  delay: number;
  /** Receives the bubble's on-screen rect, so the panel can grow out of it. */
  onOpen: () => void;
};

/** Most twigs drawn inside a bubble; the number badge always shows the real count. */
const MAX_TWIGS = 24;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type Twig = { x: number; y: number; parent: number; depth: number };

/**
 * A little branching tree with one leaf per task. Points sit on a sunflower
 * spiral; each joins the nearest point closer to the centre, so the result
 * is a tree whose branches thin out towards the edge.
 */
function buildTwigs(taskIds: string[]): Twig[] {
  const count = Math.min(taskIds.length, MAX_TWIGS);
  const twist = (hashStringToNumber(taskIds.join("")) % 360) * (Math.PI / 180);
  const twigs: Twig[] = [{ x: 50, y: 30, parent: -1, depth: 0 }];

  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 1) / count);
    const angle = twist + (i + 1) * GOLDEN_ANGLE;
    const x = 50 + Math.cos(angle) * r * 40;
    const y = 30 + Math.sin(angle) * r * 22;

    let parent = 0;
    let best = Infinity;
    twigs.forEach((t, j) => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < best) {
        best = d;
        parent = j;
      }
    });
    twigs.push({ x: round(x), y: round(y), parent, depth: twigs[parent].depth + 1 });
  }
  return twigs;
}

/** A collapsed cluster of same-domain tasks on the brain map. */
export function GroupBubble({ label, taskIds, delay, onOpen }: GroupBubbleProps) {
  const twigs = buildTwigs(taskIds);
  const count = taskIds.length;

  return (
    <button
      type="button"
      data-group-bubble
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="task-card relative flex flex-col items-center justify-center overflow-hidden rounded-[50%] bg-[var(--bubble)] transition-transform duration-300 ease-out hover:scale-110"
      style={{ animationDelay: `${delay}s` }}
      aria-label={`${label}: ${count} tasks. Open group`}
    >
      <svg viewBox="0 0 100 60" className="pointer-events-none h-[58%] w-[78%]" aria-hidden="true">
        {twigs.slice(1).map((t, i) => {
          const p = twigs[t.parent];
          // Thick near the trunk, thinning towards the leaves
          const width = round(Math.max(0.6, 2.6 - t.depth * 0.55));
          const mx = round((p.x + t.x) / 2 + (t.y - p.y) * 0.15);
          const my = round((p.y + t.y) / 2 - (t.x - p.x) * 0.15);
          return (
            <path
              key={i}
              d={`M ${p.x} ${p.y} Q ${mx} ${my} ${t.x} ${t.y}`}
              fill="none"
              stroke="rgba(170,200,235,0.55)"
              strokeWidth={width}
              strokeLinecap="round"
            />
          );
        })}
        <circle cx={twigs[0].x} cy={twigs[0].y} r="3.2" fill="rgba(200,222,245,0.7)" />
        {twigs.slice(1).map((t, i) => (
          <circle key={i} cx={t.x} cy={t.y} r="2.3" fill="rgba(232,238,247,0.85)" />
        ))}
      </svg>
      <div className="flex items-baseline gap-1.5">
        <h2 className="truncate font-[family-name:var(--font-syne)] text-[11px] font-bold tracking-wide text-[var(--ink)] sm:text-sm">
          {label}
        </h2>
        <span className="font-[family-name:var(--font-outfit)] text-[10px] text-[var(--ink-muted)] sm:text-xs">
          {count}
        </span>
      </div>
    </button>
  );
}
