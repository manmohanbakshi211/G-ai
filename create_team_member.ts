import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.findFirst();
  if (!store) {
    console.log("No store found.");
    return;
  }

  const hashedPassword = await bcrypt.hash("password", 10);

  const teamMember = await prisma.teamMember.create({
    data: {
      storeId: store.id,
      name: "Test Member",
      phone: "1234567890",
      passwordHash: hashedPassword,
    },
  });

  console.log("Team Member created:", teamMember);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
