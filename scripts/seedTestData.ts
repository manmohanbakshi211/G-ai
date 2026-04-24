import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing old data...');
  // Delete in dependency order
  await prisma.$executeRaw`DELETE FROM "Like"`;
  await prisma.$executeRaw`DELETE FROM "Post"`;
  await prisma.$executeRaw`DELETE FROM "Review"`;
  await prisma.$executeRaw`DELETE FROM "SavedItem"`;
  await prisma.$executeRaw`DELETE FROM "SearchHistory"`;
  await prisma.$executeRaw`DELETE FROM "SavedLocation"`;
  await prisma.$executeRaw`DELETE FROM "Notification"`;
  await prisma.$executeRaw`DELETE FROM "Follow"`;
  await prisma.$executeRaw`DELETE FROM "TeamMember"`;
  await prisma.$executeRaw`DELETE FROM "Report"`;
  await prisma.$executeRaw`DELETE FROM "Complaint"`;
  await prisma.$executeRaw`DELETE FROM "Message"`;
  await prisma.$executeRaw`DELETE FROM "Product"`;
  await prisma.$executeRaw`DELETE FROM "Store"`;
  await prisma.$executeRaw`DELETE FROM "User" WHERE role != 'admin'`;
  await prisma.$executeRaw`DELETE FROM "Category"`;
  console.log('✅ Old data cleared');

  const hash = await bcrypt.hash('Test@1234', 10);

  // ── Users ──
  const retailer1 = await prisma.user.create({ data: { name: 'Rahul Sharma', phone: '9876543210', password: hash, role: 'retailer', kycStatus: 'approved' } });
  const retailer2 = await prisma.user.create({ data: { name: 'Priya Patel', phone: '9876543211', password: hash, role: 'retailer', kycStatus: 'approved' } });
  const retailer3 = await prisma.user.create({ data: { name: 'Anita Verma', phone: '9876543212', password: hash, role: 'retailer', kycStatus: 'approved' } });
  const customer = await prisma.user.create({ data: { name: 'Test Customer', phone: '9876543220', password: hash, role: 'customer' } });
  console.log('✅ Users created');

  // ── Store 1: Electronics ──
  const elecStore = await prisma.store.create({ data: {
    ownerId: retailer1.id, storeName: 'TechWorld Electronics', category: 'Electronics',
    description: 'Premium electronics store with latest gadgets, phones, laptops, gaming consoles and accessories',
    latitude: 28.6139, longitude: 77.209, address: '45 Nehru Place, New Delhi',
    city: 'New Delhi', state: 'Delhi', openingTime: '10:00', closingTime: '21:00',
  }});

  // ── Store 2: Indian Restaurant ──
  const restStore = await prisma.store.create({ data: {
    ownerId: retailer2.id, storeName: 'Spice Garden Restaurant', category: 'Food & Restaurant',
    description: 'Authentic North Indian and Mughlai cuisine, biryanis, tandoor specials, and street food',
    latitude: 28.6304, longitude: 77.2177, address: '12 Connaught Place, New Delhi',
    city: 'New Delhi', state: 'Delhi', openingTime: '11:00', closingTime: '23:00',
  }});

  // ── Store 3: Beauty ──
  const beautyStore = await prisma.store.create({ data: {
    ownerId: retailer3.id, storeName: 'GlowUp Beauty Studio', category: 'Beauty & Cosmetics',
    description: 'Skincare, makeup, fragrances, haircare products and salon services',
    latitude: 28.5535, longitude: 77.2588, address: '78 Saket Mall, New Delhi',
    city: 'New Delhi', state: 'Delhi', openingTime: '10:00', closingTime: '20:00',
  }});
  console.log('✅ Stores created');

  // ── Electronics Products ──
  const electronicsProducts = [
    { productName: 'iPhone 15 Pro Max', brand: 'Apple', category: 'Smartphones', price: 159900, description: 'Latest Apple flagship with A17 Pro chip, titanium design, 48MP camera system, USB-C' },
    { productName: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', category: 'Smartphones', price: 134999, description: 'Samsung flagship with S Pen, AI features, 200MP camera, Snapdragon 8 Gen 3' },
    { productName: 'OnePlus 12', brand: 'OnePlus', category: 'Smartphones', price: 64999, description: 'Flagship killer with Snapdragon 8 Gen 3, 100W charging, Hasselblad camera' },
    { productName: 'MacBook Air M3', brand: 'Apple', category: 'Laptops', price: 114900, description: 'Ultra-thin laptop with Apple M3 chip, 18hr battery, Liquid Retina display' },
    { productName: 'Dell XPS 15', brand: 'Dell', category: 'Laptops', price: 145000, description: 'Premium Windows ultrabook with Intel Core i7, OLED display, 32GB RAM' },
    { productName: 'HP Pavilion Gaming Laptop', brand: 'HP', category: 'Laptops', price: 72990, description: 'Gaming laptop with RTX 4060, Intel i5, 144Hz display, RGB keyboard' },
    { productName: 'Sony PlayStation 5', brand: 'Sony', category: 'Gaming', price: 49990, description: 'Next-gen gaming console with 4K gaming, DualSense controller, ray tracing' },
    { productName: 'Xbox Series X', brand: 'Microsoft', category: 'Gaming', price: 49990, description: 'Powerful gaming console with 12 teraflops GPU, Quick Resume, Game Pass' },
    { productName: 'Sony WH-1000XM5', brand: 'Sony', category: 'Audio', price: 29990, description: 'Industry-leading noise cancelling headphones with 30hr battery, LDAC codec' },
    { productName: 'Apple AirPods Pro 2', brand: 'Apple', category: 'Audio', price: 24900, description: 'Premium wireless earbuds with active noise cancellation, spatial audio, USB-C' },
    { productName: 'Samsung 55" QLED Smart TV', brand: 'Samsung', category: 'Television', price: 74990, description: '55 inch 4K QLED smart TV with Tizen OS, quantum dot technology, Dolby Atmos' },
    { productName: 'LG 65" OLED TV', brand: 'LG', category: 'Television', price: 159990, description: '65 inch OLED evo with webOS, Dolby Vision IQ, perfect blacks, α9 Gen6 AI' },
    { productName: 'Samsung 325L Double Door Refrigerator', brand: 'Samsung', category: 'Appliances', price: 32990, description: 'Frost free double door fridge with digital inverter, convertible modes' },
    { productName: 'LG 1.5 Ton Split AC', brand: 'LG', category: 'Appliances', price: 42990, description: 'Dual inverter split air conditioner with Wi-Fi, 5-star energy rating, cooling' },
    { productName: 'JBL Charge 5', brand: 'JBL', category: 'Audio', price: 14999, description: 'Portable Bluetooth speaker with IP67 waterproof, 20hr playtime, powerbank' },
  ];

  // ── Restaurant Menu Items (as Products) ──
  const menuProducts = [
    { productName: 'Butter Chicken', brand: 'Spice Garden', category: 'Main Course', price: 350, description: 'Creamy tomato-based curry with tender tandoori chicken pieces, served with naan' },
    { productName: 'Paneer Tikka Masala', brand: 'Spice Garden', category: 'Main Course', price: 280, description: 'Grilled cottage cheese cubes in spiced onion-tomato gravy, rich and flavorful' },
    { productName: 'Hyderabadi Biryani', brand: 'Spice Garden', category: 'Biryani', price: 320, description: 'Fragrant basmati rice layered with spiced chicken, saffron, fried onions, dum cooked' },
    { productName: 'Veg Biryani', brand: 'Spice Garden', category: 'Biryani', price: 250, description: 'Aromatic basmati rice with mixed vegetables, herbs, saffron, served with raita' },
    { productName: 'Dal Makhani', brand: 'Spice Garden', category: 'Main Course', price: 220, description: 'Black lentils slow-cooked overnight with butter and cream, Punjabi style' },
    { productName: 'Chole Bhature', brand: 'Spice Garden', category: 'Street Food', price: 150, description: 'Spiced chickpea curry with fluffy deep-fried bread, topped with onions and pickle' },
    { productName: 'Samosa (2 pcs)', brand: 'Spice Garden', category: 'Street Food', price: 60, description: 'Crispy triangular pastry stuffed with spiced potatoes, peas, served with chutney' },
    { productName: 'Tandoori Chicken Full', brand: 'Spice Garden', category: 'Tandoor', price: 450, description: 'Whole chicken marinated in yogurt and spices, charcoal grilled in clay oven' },
    { productName: 'Garlic Naan', brand: 'Spice Garden', category: 'Breads', price: 60, description: 'Soft leavened bread topped with garlic and butter, baked in tandoor' },
    { productName: 'Masala Dosa', brand: 'Spice Garden', category: 'South Indian', price: 120, description: 'Crispy rice-lentil crepe filled with spiced potato filling, served with sambar and chutney' },
    { productName: 'Pav Bhaji', brand: 'Spice Garden', category: 'Street Food', price: 140, description: 'Mumbai style mashed vegetable curry served with buttered toasted buns' },
    { productName: 'Gulab Jamun (2 pcs)', brand: 'Spice Garden', category: 'Desserts', price: 80, description: 'Deep-fried milk solid balls soaked in cardamom-flavored sugar syrup' },
    { productName: 'Mango Lassi', brand: 'Spice Garden', category: 'Beverages', price: 100, description: 'Chilled yogurt drink blended with Alphonso mango pulp, hint of cardamom' },
    { productName: 'Masala Chai', brand: 'Spice Garden', category: 'Beverages', price: 40, description: 'Indian spiced tea with ginger, cardamom, cinnamon, brewed with milk' },
    { productName: 'Palak Paneer', brand: 'Spice Garden', category: 'Main Course', price: 260, description: 'Cottage cheese cubes in creamy spinach gravy seasoned with garlic and spices' },
  ];

  // ── Beauty Products ──
  const beautyProducts = [
    { productName: 'Lakme 9 to 5 Foundation', brand: 'Lakme', category: 'Makeup', price: 575, description: 'Weightless mousse foundation with SPF 20, matte finish, all-day wear' },
    { productName: 'MAC Ruby Woo Lipstick', brand: 'MAC', category: 'Makeup', price: 1950, description: 'Iconic retro matte red lipstick, highly pigmented, long-lasting color' },
    { productName: 'Maybelline Colossal Kajal', brand: 'Maybelline', category: 'Makeup', price: 275, description: 'Smudge-proof 24hr intense black kajal, ophthalmologist tested' },
    { productName: 'Biotique Bio Vitamin C Serum', brand: 'Biotique', category: 'Skincare', price: 399, description: 'Brightening face serum with vitamin C, reduces dark spots, natural ingredients' },
    { productName: 'Cetaphil Gentle Cleanser', brand: 'Cetaphil', category: 'Skincare', price: 490, description: 'Mild soap-free face wash for sensitive skin, dermatologist recommended' },
    { productName: 'Forest Essentials Night Cream', brand: 'Forest Essentials', category: 'Skincare', price: 2475, description: 'Luxury Ayurvedic night cream with jasmine and sandalwood, deep nourishment' },
    { productName: 'Chanel No. 5 Eau de Parfum', brand: 'Chanel', category: 'Fragrance', price: 12500, description: 'Iconic French perfume with floral-aldehyde scent, rose, jasmine, sandalwood' },
    { productName: 'Davidoff Cool Water Men', brand: 'Davidoff', category: 'Fragrance', price: 3200, description: 'Fresh aquatic mens cologne with lavender, mint, amber, and musk notes' },
    { productName: 'LOreal Paris Hair Serum', brand: 'LOreal', category: 'Haircare', price: 490, description: 'Smoothing and shine hair serum, frizz control, heat protection up to 230°C' },
    { productName: 'Tresemme Keratin Shampoo', brand: 'Tresemme', category: 'Haircare', price: 545, description: 'Salon-smooth keratin shampoo for straighter, shinier hair with 5 benefits' },
    { productName: 'Mamaearth Ubtan Face Mask', brand: 'Mamaearth', category: 'Skincare', price: 499, description: 'Turmeric and saffron face pack for tan removal, skin brightening, natural glow' },
    { productName: 'Nivea Body Lotion', brand: 'Nivea', category: 'Body Care', price: 349, description: 'Deep moisture body lotion with almond oil and vitamin E, 48hr hydration' },
    { productName: 'Himalaya Neem Face Wash', brand: 'Himalaya', category: 'Skincare', price: 175, description: 'Herbal neem and turmeric face wash for pimple and acne prevention' },
    { productName: 'Engagement Mehendi Service', brand: 'GlowUp', category: 'Salon Services', price: 3500, description: 'Professional bridal and engagement henna/mehendi design application service' },
    { productName: 'Hair Spa Treatment', brand: 'GlowUp', category: 'Salon Services', price: 1500, description: 'Deep conditioning hair spa with keratin treatment, head massage included' },
  ];

  // Bulk create products
  for (const p of electronicsProducts) {
    await prisma.product.create({ data: { ...p, storeId: elecStore.id } });
  }
  for (const p of menuProducts) {
    await prisma.product.create({ data: { ...p, storeId: restStore.id } });
  }
  for (const p of beautyProducts) {
    await prisma.product.create({ data: { ...p, storeId: beautyStore.id } });
  }
  console.log(`✅ ${electronicsProducts.length + menuProducts.length + beautyProducts.length} products created`);

  // Categories
  const cats = ['Electronics', 'Food & Restaurant', 'Beauty & Cosmetics', 'Fashion', 'Groceries', 'Home & Living'];
  for (const c of cats) {
    await prisma.category.create({ data: { categoryName: c } });
  }
  console.log('✅ Categories created');
  console.log('\n📋 Test accounts (password: Test@1234):');
  console.log(`  Retailer 1 (Electronics): ${retailer1.phone}`);
  console.log(`  Retailer 2 (Restaurant):  ${retailer2.phone}`);
  console.log(`  Retailer 3 (Beauty):      ${retailer3.phone}`);
  console.log(`  Customer:                 ${customer.phone}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
