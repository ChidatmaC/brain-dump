import { prisma } from "@/lib/prisma";
import { BrainField, type Task } from "@/app/components/BrainField";

export const dynamic = "force-dynamic";

export default async function Home() {
  let tasks: Task[] = [];

  try {
    const rows = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
    });
    tasks = rows.map((task) => ({
      id: task.id,
      title: task.title,
      content: task.content,
      createdAt: task.createdAt.toISOString(),
    }));
  } catch {
    tasks = [];
  }

  return (
    <div className="page-gradient relative min-h-screen overflow-x-hidden">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col items-center justify-center px-4 py-12 sm:px-8">
        <header className="mb-6 text-center sm:mb-8">
          <p className="mb-3 font-[family-name:var(--font-outfit)] text-xs uppercase tracking-[0.28em] text-[var(--ink-muted)]">
            scatter the noise
          </p>
          <h1 className="font-[family-name:var(--font-syne)] text-5xl font-bold tracking-tight text-[var(--ink)] sm:text-7xl">
            Brain Dump
          </h1>
        </header>

        <BrainField initialTasks={tasks} />
      </main>
    </div>
  );
}
