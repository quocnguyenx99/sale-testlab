import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { prisma } from "./prismaClient";

export async function bootstrapDevelopmentUser(client: PrismaClient, environment: NodeJS.ProcessEnv): Promise<void> {
  const email = (environment.DEV_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
  const password = environment.DEV_BOOTSTRAP_PASSWORD || "";
  const displayName = (environment.DEV_BOOTSTRAP_DISPLAY_NAME || "").trim();
  if (!email || !password || !displayName) {
    throw new Error("DEV_BOOTSTRAP_ONLY requires DEV_BOOTSTRAP_EMAIL, DEV_BOOTSTRAP_PASSWORD and DEV_BOOTSTRAP_DISPLAY_NAME");
  }
  if (password.length < 10) throw new Error("DEV_BOOTSTRAP_PASSWORD must contain at least 10 characters");
  const passwordHash = await hash(password, 12);
  await client.user.upsert({
    where: { email },
    create: { email, passwordHash, displayName, role: "SALE", status: "ACTIVE" },
    update: { passwordHash, displayName, status: "ACTIVE" }
  });
}

async function main(): Promise<void> {
  await bootstrapDevelopmentUser(prisma, process.env);
  console.log("DEV_BOOTSTRAP_ONLY user initialized.");
}

if (require.main === module) {
  main()
    .catch((error) => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
