// One-off: assign all ownerless tasks to the user with the given email.
// Usage: npx tsx prisma/backfill-task-owner.ts you@example.com
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npx tsx prisma/backfill-task-owner.ts <email>");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user found with email ${email}`);

  const { count } = await prisma.task.updateMany({
    where: { userId: null },
    data: { userId: user.id },
  });
  console.log(`Assigned ${count} task(s) to ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
