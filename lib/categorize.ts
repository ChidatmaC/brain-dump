import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ timeout: 8_000, maxRetries: 1 });

const CategorySchema = z.object({ category: z.string() });

const SYSTEM_PROMPT = `You sort a person's brain-dump notes and tasks into life domains (for example: School, Errands, Work, Health, Finance, Home, Social, Ideas).
Return one short domain label for the note: 1-2 words, Title Case.
If one of the person's existing labels fits, return it exactly. Only invent a new label when none of them fit.`;

function titleCase(label: string) {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 24);
}

/** Ask Claude for a domain label. Never throws: returns null if labelling fails. */
export async function categorizeTask(
  task: { title: string | null; content: string },
  existing: string[],
): Promise<string | null> {
  try {
    const response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(CategorySchema),
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Existing labels: ${existing.length ? existing.join(", ") : "(none yet)"}

Note title: ${task.title ?? "(none)"}
Note: ${task.content}`,
        },
      ],
    });

    const raw = response.parsed_output?.category;
    if (!raw?.trim()) return null;

    const label = titleCase(raw);
    // Reuse an existing label when it only differs by case/spacing
    return existing.find((e) => e.toLowerCase() === label.toLowerCase()) ?? label;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`Categorize failed (${error.status}):`, error.message);
    } else {
      console.error("Categorize failed", error);
    }
    return null;
  }
}

export async function existingCategories(userId: string) {
  const rows = await prisma.task.findMany({
    where: { userId, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
  });
  return rows.flatMap((r) => (r.category ? [r.category] : []));
}
