import { hash } from "bcryptjs";
import { prisma } from "./prismaClient";

async function main(): Promise<void> {
  const email = (process.env.DEV_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
  const password = process.env.DEV_BOOTSTRAP_PASSWORD || "";
  const displayName = (process.env.DEV_BOOTSTRAP_DISPLAY_NAME || "").trim();
  if (!email || !password || !displayName) {
    throw new Error("DEV_BOOTSTRAP_ONLY requires DEV_BOOTSTRAP_EMAIL, DEV_BOOTSTRAP_PASSWORD and DEV_BOOTSTRAP_DISPLAY_NAME");
  }
  if (password.length < 10) throw new Error("DEV_BOOTSTRAP_PASSWORD must contain at least 10 characters");
  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, displayName, role: "SALE", status: "ACTIVE" },
    update: { passwordHash, displayName, status: "ACTIVE" }
  });
  console.log("DEV_BOOTSTRAP_ONLY user initialized.");
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
