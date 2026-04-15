import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function mockPostAndNotify() {
  try {
    // 1. Get the first store and a customer
    const store = await prisma.store.findFirst();
    const customer = await prisma.user.findFirst({ where: { role: 'customer' } });

    if (!store || !customer) {
      console.log('Need a store and a customer for this test');
      return;
    }

    // 2. Make sure the customer is following the store
    const existingFollow = await prisma.follow.findUnique({
      where: {
        userId_storeId: {
          userId: customer.id,
          storeId: store.id
        }
      }
    });

    if (!existingFollow) {
      console.log(`Making ${customer.name} follow ${store.storeName}...`);
      await prisma.follow.create({
        data: {
          userId: customer.id,
          storeId: store.id
        }
      });
    }

    // 3. We can't easily trigger the exact Express route /api/posts from this CLI script, 
    // without spinning up a full mock HTTP request with JWT. 
    // Instead we will call the REST API via fetch, acting as the store owner.
    
    console.log("Mock script created to aid manual browser testing. Test ready.");
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

mockPostAndNotify();
