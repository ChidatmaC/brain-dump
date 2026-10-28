export const CARD_WIDTH_PCT = 17;
export const CARD_HEIGHT_PCT = 15;
export const CARD_GAP_PCT = 1.5;

export type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
  delay: number;
};

/** `weight` thickens the neuron links touching this node (big branches = thick links). */
export type PlacedNode = { id: string; weight: number } & Placement;

/** A thing to place: its id, plus an optional key that pulls related nodes to the same spot. */
export type LayoutItem = {
  id: string;
  anchorKey?: string | null;
  /** Size multiplier relative to a task card (default 1). */
  scale?: number;
  /** Link thickness multiplier (default 1). */
  weight?: number;
};

type Rect = Pick<Placement, "left" | "top" | "width" | "height">;

export function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function rectsOverlap(a: Rect, b: Rect) {
  const gap = CARD_GAP_PCT;
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

function* candidateOffsets(maxRadius: number, step: number) {
  let x = 0;
  let y = 0;
  let dx = 0;
  let dy = -1;
  const max = Math.ceil(maxRadius / step);
  const side = 2 * max + 1;

  // Walk a square spiral covering ±maxRadius in both directions
  for (let i = 0; i < side * side; i++) {
    if (-max <= x && x <= max && -max <= y && y <= max) {
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

/** Centre point, in field percentages. */
type Point = { x: number; y: number };

/**
 * Round to 3 decimals. Trig results can differ in the last bit between the
 * server (Node) and some browsers, which would make SSR markup and the
 * hydrated client disagree; rounding keeps them identical.
 */
export function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/**
 * Find a free spot for a node, spiralling out from `anchor` when given
 * (so nodes sharing an anchor pack together), else from a point derived
 * from the node id (random scatter).
 */
export function placeNode(
  id: string,
  placed: PlacedNode[],
  index: number,
  totalNodes: number,
  anchor?: Point,
  scale = 1,
): Placement {
  const seed = hashStringToNumber(id);
  const delay = (seed % 10) * 0.06;
  const normSeed = (seed % 1000) / 1000;
  const width = CARD_WIDTH_PCT * scale;
  const height = CARD_HEIGHT_PCT * scale;

  // Small per-node jitter so anchored groups don't look like a rigid grid
  const baseLeft = anchor
    ? anchor.x - width / 2 + ((seed % 7) - 3) * 0.6
    : 6 + (78 - width) * normSeed;
  const baseTop = anchor
    ? anchor.y - height / 2 + (((seed >> 3) % 7) - 3) * 0.6
    : 8 + (74 - height) * ((normSeed * 7) % 1);

  for (const [dx, dy] of candidateOffsets(100, 2.5)) {
    const candidate = { left: baseLeft + dx, top: baseTop + dy, width, height };

    if (
      candidate.left < 2 ||
      candidate.top < 2 ||
      candidate.left + width > 98 ||
      candidate.top + height > 98
    ) {
      continue;
    }

    const overlaps = placed.some((p) => rectsOverlap(candidate, p));
    if (!overlaps) {
      return {
        left: round(candidate.left),
        top: round(candidate.top),
        width: round(width),
        height: round(height),
        delay: round(delay),
      };
    }
  }

  const cols = Math.ceil(Math.sqrt(Math.max(totalNodes, 1)));
  const row = Math.floor(index / cols);
  const col = index % cols;
  return {
    left: round(Math.min(98 - width, 4 + col * (CARD_WIDTH_PCT + CARD_GAP_PCT))),
    top: round(Math.min(98 - height, 4 + row * (CARD_HEIGHT_PCT + CARD_GAP_PCT))),
    width: round(width),
    height: round(height),
    delay: round(delay),
  };
}

/** Spread anchor points evenly around an ellipse so different domains start far apart. */
function anchorPoints(keys: string[]): Map<string, Point> {
  const anchors = new Map<string, Point>();
  const k = keys.length;
  keys.forEach((key, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(k, 1);
    const radius = k === 1 ? 0 : 1;
    const cx = 50 + 31 * radius * Math.cos(angle);
    const cy = 50 + 28 * radius * Math.sin(angle);
    anchors.set(key, { x: round(cx), y: round(cy) });
  });
  return anchors;
}

/**
 * Place items, returning placements in the same order as `items`.
 * Items sharing an anchorKey are placed as one batch around their anchor so
 * each domain forms a tight cluster. Deterministic for a given input.
 */
export function layoutNodes(items: LayoutItem[]): PlacedNode[] {
  // Anchor keys in first-appearance order; earlier domains claim space first
  const keys: string[] = [];
  for (const item of items) {
    if (item.anchorKey && !keys.includes(item.anchorKey)) keys.push(item.anchorKey);
  }
  const anchors = anchorPoints(keys);

  const groupIndex = (item: LayoutItem) =>
    item.anchorKey ? keys.indexOf(item.anchorKey) : keys.length;
  const order = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => groupIndex(a.item) - groupIndex(b.item) || a.i - b.i);

  const placed: PlacedNode[] = [];
  const result: PlacedNode[] = new Array(items.length);
  order.forEach(({ item, i }, n) => {
    const anchor = item.anchorKey ? anchors.get(item.anchorKey) : undefined;
    const node = {
      id: item.id,
      weight: item.weight ?? 1,
      ...placeNode(item.id, placed, n, items.length, anchor, item.scale),
    };
    placed.push(node);
    result[i] = node;
  });
  return result;
}

function hasOverlap(nodes: PlacedNode[]) {
  return nodes.some((a, i) =>
    nodes.some(
      (b, j) =>
        j > i &&
        Math.abs(a.left - b.left) < Math.min(a.width, b.width) &&
        Math.abs(a.top - b.top) < Math.min(a.height, b.height),
    ),
  );
}

/**
 * Like layoutNodes, but if the nodes don't all fit without overlapping,
 * shrink every node a step at a time (down to half size) until they do.
 */
export function fitLayout(items: LayoutItem[]): PlacedNode[] {
  let nodes = layoutNodes(items);
  for (let shrink = 0.9; hasOverlap(nodes) && shrink >= 0.5; shrink -= 0.1) {
    nodes = layoutNodes(items.map((item) => ({ ...item, scale: (item.scale ?? 1) * shrink })));
  }
  return nodes;
}

export function cardCenter(node: Rect) {
  return {
    x: node.left + node.width / 2,
    y: node.top + node.height / 2,
  };
}

/** Rough radius, so a big bubble's edge (not its centre) decides who is nearest. */
function nodeRadius(node: Rect) {
  return (node.width + node.height) / 4;
}

export type NeuronEdge = {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx: number;
  cy: number;
  /** Stroke multiplier: links into big groups are drawn thicker, like main branches. */
  weight: number;
};

/** Gap between two nodes' edges (roughly), used to decide which node is "closest". */
function nodeGap(a: PlacedNode, b: PlacedNode) {
  const ca = cardCenter(a);
  const cb = cardCenter(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) - nodeRadius(a) - nodeRadius(b);
}

function makeEdge(from: PlacedNode, to: PlacedNode): NeuronEdge {
  const a = cardCenter(from);
  const b = cardCenter(to);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Offset the curve perpendicular to the segment for an organic axon look
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(6, len * 0.18);
  return {
    key: [from.id, to.id].sort().join(":"),
    x1: round(a.x),
    y1: round(a.y),
    x2: round(b.x),
    y2: round(b.y),
    cx: round(mx - (dy / len) * bend),
    cy: round(my + (dx / len) * bend),
    weight: round((from.weight + to.weight) / 2),
  };
}

/**
 * Connect each node to its nearest neighbor, then join any islands that
 * creates with the shortest available link, so the whole graph is one
 * connected tree of branches. Undirected edges are deduped.
 */
export function buildNeuronEdges(nodes: PlacedNode[]): NeuronEdge[] {
  const edges = new Map<string, NeuronEdge>();

  // Union-find over node indices, to track which nodes are already connected
  const parent = nodes.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const connect = (i: number, j: number) => {
    const edge = makeEdge(nodes[i], nodes[j]);
    if (!edges.has(edge.key)) edges.set(edge.key, edge);
    parent[find(i)] = find(j);
  };

  nodes.forEach((node, i) => {
    let nearest = -1;
    let best = Infinity;
    nodes.forEach((other, j) => {
      if (i === j) return;
      const gap = nodeGap(node, other);
      if (gap < best) {
        best = gap;
        nearest = j;
      }
    });
    if (nearest !== -1) connect(i, nearest);
  });

  // Nearest-neighbour links can leave separate islands (two pairs that are
  // each other's closest). Bridge them, closest pair first, until one remains.
  for (;;) {
    let bestPair: [number, number] | null = null;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (find(i) === find(j)) continue;
        const gap = nodeGap(nodes[i], nodes[j]);
        if (gap < best) {
          best = gap;
          bestPair = [i, j];
        }
      }
    }
    if (!bestPair) break;
    connect(bestPair[0], bestPair[1]);
  }

  return [...edges.values()];
}

export function fieldSize(nodeCount: number) {
  const count = Math.max(nodeCount, 10);
  const widthVw = Math.min(96, 82 + (count - 10) * 1.1);
  const maxPx = Math.min(1280, 1040 + (count - 10) * 24);
  return {
    width: `${widthVw}vw`,
    maxWidth: `${maxPx}px`,
  };
}
