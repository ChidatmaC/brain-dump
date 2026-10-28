// One-off: give every unlabelled task a domain label via Claude.
// Usage: npx tsx prisma/backfill-categories.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { categorizeTask } from "../lib/categorize";

async function main() {
  const tasks = await prisma.task.findMany({
    where: { category: null, userId: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  // Track labels per user so each task can reuse labels made earlier in the run
  const labelsByUser = new Map<string, Set<string>>();
  let labelled = 0;

  for (const task of tasks) {
    const userId = task.userId!;
    if (!labelsByUser.has(userId)) {
      const rows = await prisma.task.findMany({
        where: { userId, category: { not: null } },
        distinct: ["category"],
        select: { category: true },
      });
      labelsByUser.set(userId, new Set(rows.flatMap((r) => (r.category ? [r.category] : []))));
    }
    const labels = labelsByUser.get(userId)!;

    const category = await categorizeTask(task, [...labels]);
    if (!category) {
      console.log(`Skipped ${task.id} (no label returned)`);
      continue;
    }
    await prisma.task.update({ where: { id: task.id }, data: { category } });
    labels.add(category);
    labelled++;
    console.log(`${category.padEnd(16)} ← ${(task.title ?? task.content).slice(0, 60)}`);
  }

  console.log(`Labelled ${labelled} of ${tasks.length} task(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
