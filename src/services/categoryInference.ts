/**
 * Category inference — maps search terms to likely store/product categories
 * so irrelevant cross-category results are filtered out.
 */

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Electronics': [
    'phone', 'mobile', 'smartphone', 'iphone', 'samsung', 'oneplus', 'laptop', 'macbook',
    'notebook', 'tablet', 'ipad', 'tv', 'television', 'led', 'oled', 'monitor',
    'headphone', 'earphone', 'earbuds', 'airpods', 'speaker', 'bluetooth',
    'ps5', 'playstation', 'xbox', 'gaming', 'console', 'controller',
    'camera', 'dslr', 'gopro', 'drone', 'charger', 'cable', 'usb',
    'fridge', 'refrigerator', 'ac', 'air conditioner', 'washing machine',
    'microwave', 'oven', 'printer', 'router', 'wifi', 'smartwatch', 'watch',
    'power bank', 'ssd', 'hard drive', 'ram', 'processor', 'gpu', 'keyboard', 'mouse',
    'electronics', 'gadget', 'tech', 'computer', 'desktop', 'apple', 'dell', 'hp',
    'lenovo', 'asus', 'acer', 'sony', 'lg', 'jbl', 'bose',
  ],
  'Food & Restaurant': [
    'food', 'restaurant', 'biryani', 'pizza', 'burger', 'chicken', 'paneer',
    'naan', 'roti', 'dal', 'curry', 'masala', 'tandoori', 'tikka',
    'dosa', 'idli', 'sambar', 'chutney', 'samosa', 'pakora', 'bhaji',
    'chole', 'bhature', 'paratha', 'thali', 'rice', 'pulao',
    'dessert', 'gulab jamun', 'rasgulla', 'kheer', 'halwa',
    'chai', 'tea', 'coffee', 'lassi', 'juice', 'shake', 'smoothie',
    'cake', 'pastry', 'ice cream', 'chocolate', 'sweet', 'mithai',
    'breakfast', 'lunch', 'dinner', 'snack', 'appetizer', 'starter',
    'veg', 'non-veg', 'vegetarian', 'mughlai', 'chinese', 'italian',
    'south indian', 'north indian', 'street food', 'pav bhaji',
    'eat', 'hungry', 'spicy', 'cuisine', 'menu', 'order',
  ],
  'Beauty & Cosmetics': [
    'beauty', 'cosmetic', 'makeup', 'lipstick', 'foundation', 'mascara',
    'eyeliner', 'kajal', 'blush', 'concealer', 'primer', 'compact',
    'skincare', 'moisturizer', 'sunscreen', 'serum', 'cream', 'lotion',
    'face wash', 'cleanser', 'toner', 'exfoliator', 'face mask',
    'shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair spa',
    'perfume', 'fragrance', 'deodorant', 'deo', 'body spray', 'attar', 'cologne',
    'nail polish', 'nail art', 'mehendi', 'henna', 'wax', 'salon',
    'facial', 'parlour', 'parlor', 'spa', 'grooming', 'trim', 'haircut',
    'lakme', 'mac', 'maybelline', 'loreal', 'nivea', 'dove', 'himalaya',
    'biotique', 'mamaearth', 'cetaphil', 'forest essentials', 'chanel',
  ],
  'Fashion': [
    'fashion', 'clothes', 'clothing', 'shirt', 'tshirt', 'jeans', 'trouser',
    'kurti', 'saree', 'sari', 'lehenga', 'dress', 'gown', 'suit',
    'jacket', 'hoodie', 'sweater', 'blazer', 'coat',
    'shoes', 'sneakers', 'sandals', 'heels', 'boots', 'slippers',
    'bag', 'handbag', 'purse', 'wallet', 'belt', 'cap', 'hat',
    'sunglasses', 'goggles', 'accessory', 'jewellery', 'earring', 'necklace',
    'ring', 'bracelet', 'bangle',
  ],
  'Grocery': [
    'grocery', 'atta', 'flour', 'rice', 'dal', 'lentil', 'oil',
    'sugar', 'salt', 'spice', 'turmeric', 'chili', 'cumin',
    'milk', 'curd', 'butter', 'ghee', 'cheese', 'paneer',
    'vegetable', 'fruit', 'onion', 'potato', 'tomato',
    'biscuit', 'chips', 'namkeen', 'noodles', 'pasta',
    'soap', 'detergent', 'tissue', 'toothpaste',
  ],
};

/**
 * Infer the most likely category from a search query.
 * Returns the category name or null if no strong match.
 */
export function inferCategory(query: string): string | null {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      // Exact word match
      if (words.includes(kw)) {
        score += 3;
      }
      // Phrase contained in query
      else if (kw.includes(' ') && q.includes(kw)) {
        score += 3;
      }
      // Partial match (query word starts with keyword or vice versa)
      else {
        for (const w of words) {
          if (w.length >= 3 && (kw.startsWith(w) || w.startsWith(kw))) {
            score += 1;
          }
        }
      }
    }
    if (score > 0) scores[category] = score;
  }

  // Pick the highest scoring category, but only if it's clearly dominant
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const [bestCat, bestScore] = entries[0];
  const secondScore = entries.length > 1 ? entries[1][1] : 0;

  // Only return if the best category is meaningfully ahead
  if (bestScore >= 2 && bestScore > secondScore * 1.5) {
    return bestCat;
  }

  return bestScore >= 3 ? bestCat : null;
}

/**
 * Maps a detected category to the store categories that should be included.
 */
export function getStoreCategoriesForQuery(inferredCategory: string): string[] {
  const map: Record<string, string[]> = {
    'Electronics': ['Electronics', 'Electronics & Gadgets', 'Mobile & Accessories'],
    'Food & Restaurant': ['Food & Restaurant', 'Restaurant', 'Food', 'Cafe', 'Bakery', 'Street Food'],
    'Beauty & Cosmetics': ['Beauty & Cosmetics', 'Beauty', 'Cosmetics', 'Salon', 'Spa'],
    'Fashion': ['Fashion', 'Clothing', 'Apparel', 'Footwear', 'Accessories'],
    'Grocery': ['Grocery', 'Groceries', 'Supermarket', 'Kirana'],
  };
  return map[inferredCategory] || [inferredCategory];
}
