import type { ReactNode } from "react";
import { buildNeuronEdges, type PlacedNode } from "@/lib/layout";

type TaskGraphProps<T extends PlacedNode> = {
  nodes: T[];
  renderNode: (node: T) => ReactNode;
  /** Unique per graph on the page, so the svg gradient ids don't collide. */
  idPrefix: string;
  /** Node drawn above all others (e.g. an expanded card). */
  raisedId?: string | null;
};

/** Absolutely-positioned nodes joined to their nearest neighbour by neuron curves. */
export function TaskGraph<T extends PlacedNode>({ nodes, renderNode, idPrefix, raisedId }: TaskGraphProps<T>) {
  const neurons = buildNeuronEdges(nodes);
  const gradientId = `${idPrefix}-neuron-stroke`;

  // While a node is raised (expanded), everything else recedes behind it
  const recede = "opacity-40";

  return (
    <>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${raisedId ? recede : ""}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
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
              stroke={`url(#${gradientId})`}
              strokeWidth={0.35 * edge.weight}
              strokeLinecap="round"
            />
            <circle cx={edge.x1} cy={edge.y1} r="0.35" fill="rgba(170,200,235,0.45)" />
            <circle cx={edge.x2} cy={edge.y2} r="0.35" fill="rgba(170,200,235,0.45)" />
          </g>
        ))}
      </svg>

      <div className="absolute inset-0">
        {nodes.map((node) => (
          <div
            key={node.id}
            // Each wrapper's float animation creates its own stacking context, so a
            // card's own z-index can't lift it over neighbours; raise the wrapper instead.
            className={`task-float absolute transition-opacity duration-300 ${
              !raisedId ? "hover:z-30" : node.id === raisedId ? "" : recede
            }`}
            style={{
              zIndex: node.id === raisedId ? 50 : raisedId ? 0 : undefined,
              left: `${node.left}%`,
              top: `${node.top}%`,
              width: `${node.width}%`,
              height: `${node.height}%`,
              animationDelay: `${node.delay + 0.55}s`,
            }}
          >
            {renderNode(node)}
          </div>
        ))}
      </div>
    </>
  );
}
