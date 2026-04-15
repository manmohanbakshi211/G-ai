import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  // 1. Create a Customer
  await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      email: 'customer@test.com',
      name: 'Test Customer',
      password,
      role: 'customer',
      location: '123 Customer St'
    }
  });

  // 2. Create a Retailer
  const retailer = await prisma.user.upsert({
    where: { email: 'retailer@test.com' },
    update: {},
    create: {
      email: 'retailer@test.com',
      name: 'Test Retailer',
      password,
      role: 'retailer',
      location: '123 Retailer St'
    }
  });

  // Create Retailer's Store
  await prisma.store.upsert({
    where: { id: 'test-store-retailer' },
    update: {},
    create: {
      id: 'test-store-retailer',
      ownerId: retailer.id,
      storeName: "Retailer's Goods",
      category: 'General',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Retailer St',
      phone: '555-0001'
    }
  });

  // 3. Create a Supplier
  const supplier = await prisma.user.upsert({
    where: { email: 'supplier@test.com' },
    update: {},
    create: {
      email: 'supplier@test.com',
      name: 'Test Supplier',
      password,
      role: 'supplier',
      location: '123 Supplier St'
    }
  });

  // Create Supplier's Store
  await prisma.store.upsert({
    where: { id: 'test-store-supplier' },
    update: {},
    create: {
      id: 'test-store-supplier',
      ownerId: supplier.id,
      storeName: "Supplier's Wholesale",
      category: 'Wholesale',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Supplier St',
      phone: '555-0002'
    }
  });

  console.log("Seeding complete!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
