import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const phone = '8595572765';
  const password = '12345678';
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      password: hashedPassword,
      role: 'admin',
    },
    create: {
      name: 'Mandeep',
      phone,
      password: hashedPassword,
      role: 'admin',
    },
  });
  
  console.log('Admin user configured successfully:', user.phone);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
