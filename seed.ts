// WARNING: Test data only. Do NOT run this script in production — it deletes all data.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Clean up
  await prisma.message.deleteMany();
  await prisma.post.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // Hash default password
  const saltRounds = 10;
  const defaultPassword = await bcrypt.hash('password123', saltRounds);

  // Create Users
  const customer = await prisma.user.create({
    data: {
      id: 'user1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: defaultPassword,
      role: 'customer',
      location: 'San Francisco, CA'
    }
  });

  const retailer1 = await prisma.user.create({
    data: {
      id: 'retailer1',
      name: 'John Smith',
      email: 'john@techhaven.com',
      password: defaultPassword,
      role: 'retailer',
      location: 'San Francisco, CA'
    }
  });

  const retailer2 = await prisma.user.create({
    data: {
      id: 'retailer2',
      name: 'Sarah Lee',
      email: 'sarah@sneakerworld.com',
      password: defaultPassword,
      role: 'retailer',
      location: 'San Francisco, CA'
    }
  });

  // Create Stores
  const store1 = await prisma.store.create({
    data: {
      id: 'store1',
      ownerId: retailer1.id,
      storeName: 'Tech Haven',
      category: 'Electronics',
      description: 'Your local source for the latest electronics and gadgets.',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Market St, San Francisco, CA',
      phone: '555-0123',
      openingHours: 'Mon-Sat: 10AM-8PM'
    }
  });

  const store2 = await prisma.store.create({
    data: {
      id: 'store2',
      ownerId: retailer2.id,
      storeName: 'Sneaker World',
      category: 'Fashion',
      description: 'Premium sneakers and streetwear.',
      latitude: 37.7833,
      longitude: -122.4167,
      address: '456 Union Square, San Francisco, CA',
      phone: '555-0456',
      openingHours: 'Mon-Sun: 11AM-7PM'
    }
  });

  // Create Products
  const prod1 = await prisma.product.create({
    data: {
      id: 'prod1',
      storeId: store1.id,
      productName: 'iPhone 15 Pro',
      brand: 'Apple',
      category: 'Smartphones',
      price: 999.00,
      description: 'Latest Apple smartphone with titanium design.',
      tags: 'phone,apple,iphone'
    }
  });

  const prod2 = await prisma.product.create({
    data: {
      id: 'prod2',
      storeId: store1.id,
      productName: 'Sony WH-1000XM5',
      brand: 'Sony',
      category: 'Audio',
      price: 348.00,
      description: 'Industry leading noise canceling headphones.',
      tags: 'headphones,audio,sony'
    }
  });

  const prod3 = await prisma.product.create({
    data: {
      id: 'prod3',
      storeId: store2.id,
      productName: 'Nike Air Max 270',
      brand: 'Nike',
      category: 'Shoes',
      price: 160.00,
      description: 'Lifestyle shoe with large Air unit.',
      tags: 'shoes,sneakers,nike'
    }
  });

  // Create Posts
  await prisma.post.create({
    data: {
      storeId: store1.id,
      productId: prod1.id,
      imageUrl: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80',
      caption: 'Just restocked! The new iPhone 15 Pro in Natural Titanium is available now. Come check it out in store today.',
    }
  });

  await prisma.post.create({
    data: {
      storeId: store2.id,
      productId: prod3.id,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
      caption: 'Fresh drop! Nike Air Max 270s in the classic red colorway. Limited sizes available.',
    }
  });

  await prisma.post.create({
    data: {
      storeId: store1.id,
      productId: prod2.id,
      imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80',
      caption: 'Block out the noise with the Sony WH-1000XM5. On sale this week only!',
    }
  });

  // Create Messages
  await prisma.message.create({
    data: {
      senderId: customer.id,
      receiverId: retailer1.id,
      message: 'Hi, do you have the iPhone 15 Pro in stock?'
    }
  });

  await prisma.message.create({
    data: {
      senderId: retailer1.id,
      receiverId: customer.id,
      message: 'Yes, we have the iPhone 15 Pro in stock.'
    }
  });

  console.log('Database seeded!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
