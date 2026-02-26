import { ProductProps } from '../components/NutritionCard';

// South African nutrition products with ZAR pricing and real product images
// All image URLs verified to return HTTP 200

export const products: ProductProps[] = [
  // ============ GELS ============

  // GU Energy Gels
  {
    id: 'gu-energy-gel',
    brand: 'GU Energy',
    name: 'Energy Gel',
    calories: 100,
    carbs: 22,
    sodium: 60,
    caffeine: 20,
    color: 'orange',
    priceZAR: 36.99,
    image: 'https://guenergy.com/cdn/shop/files/Chocolate_Outrage_Gel_Single_b40b2fb1-d8d2-4967-a204-d81495c0f643.png?v=1744311288',
    category: 'gel',
  },
  {
    id: 'gu-roctane',
    brand: 'GU Energy',
    name: 'Roctane Ultra',
    calories: 100,
    carbs: 21,
    sodium: 125,
    caffeine: 35,
    color: 'orange',
    priceZAR: 60.99,
    image: 'https://guenergy.com/cdn/shop/products/roctransparent.png?v=1677544286',
    category: 'gel',
  },

  // Maurten Gels
  {
    id: 'maurten-gel-100',
    brand: 'Maurten',
    name: 'Gel 100',
    calories: 100,
    carbs: 25,
    sodium: 0,
    caffeine: 0,
    color: 'white',
    priceZAR: 75.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten100_Gel_Update25.png?v=1762198230',
    category: 'gel',
  },
  {
    id: 'maurten-gel-100-caf',
    brand: 'Maurten',
    name: 'Gel 100 Caf',
    calories: 100,
    carbs: 25,
    sodium: 0,
    caffeine: 100,
    color: 'white',
    priceZAR: 85.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten100Caf100_Gel_Update25.png?v=1762198452',
    category: 'gel',
  },
  {
    id: 'maurten-gel-160',
    brand: 'Maurten',
    name: 'Gel 160',
    calories: 160,
    carbs: 40,
    sodium: 0,
    caffeine: 0,
    color: 'white',
    priceZAR: 105.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten_Gel160_2025_bright.png?v=1759500382',
    category: 'gel',
  },

  // SIS Science in Sport
  {
    id: 'sis-go-isotonic',
    brand: 'SIS',
    name: 'GO Isotonic Gel',
    calories: 87,
    carbs: 22,
    sodium: 10,
    caffeine: 0,
    color: 'blue',
    priceZAR: 35.00,
    image: 'https://www.scienceinsport.com/media/catalog/product/s/i/sis_orange_isotonic_gel.png?optimize=medium&fit=bounds&height=400&width=400',
    category: 'gel',
  },
  {
    id: 'sis-beta-fuel',
    brand: 'SIS',
    name: 'Beta Fuel Gel',
    calories: 160,
    carbs: 40,
    sodium: 20,
    caffeine: 0,
    color: 'blue',
    priceZAR: 55.00,
    image: 'https://www.scienceinsport.com/media/catalog/product/b/e/beta_fuel_gel_strawberry_lime.png?optimize=medium&fit=bounds&height=400&width=400',
    category: 'gel',
  },

  // 32Gi (South African brand)
  {
    id: '32gi-sports-gel',
    brand: '32Gi',
    name: 'Sports Gel',
    calories: 80,
    carbs: 21,
    sodium: 59,
    caffeine: 0,
    color: 'green',
    priceZAR: 33.99,
    image: 'https://32gi.co.za/cdn/shop/files/32Gi_Sports-Gel_Blood-Orange-Box20_Comrades-Image.jpg?v=1707542601&width=400',
    category: 'gel',
  },
  {
    id: '32gi-race-pro-300',
    brand: '32Gi',
    name: 'Race Pro 300',
    calories: 300,
    carbs: 60,
    sodium: 180,
    caffeine: 0,
    color: 'green',
    priceZAR: 89.00,
    image: 'https://32gi.co.za/cdn/shop/files/32Gi_Race-Pro-Gel_Cappuccino-Render.jpg?v=1721056334&width=400',
    category: 'gel',
  },

  // USN (South African brand)
  {
    id: 'usn-vooma-gel',
    brand: 'USN',
    name: 'Vooma Gel',
    calories: 100,
    carbs: 25,
    sodium: 50,
    caffeine: 0,
    color: 'red',
    priceZAR: 21.99,
    image: 'https://za.usn.global/cdn/shop/files/VOOMA-GEL_3.webp?v=1742455598&width=400',
    category: 'gel',
  },
  {
    id: 'usn-vooma-caf',
    brand: 'USN',
    name: 'Vooma + Caffeine',
    calories: 100,
    carbs: 25,
    sodium: 50,
    caffeine: 50,
    color: 'red',
    priceZAR: 24.99,
    image: 'https://za.usn.global/cdn/shop/files/VOOMA-GEL_3.webp?v=1742455598&width=400',
    category: 'gel',
  },

  // Biogen (Dis-Chem brand)
  {
    id: 'biogen-real-gel',
    brand: 'Biogen',
    name: 'High Energy Gel',
    calories: 90,
    carbs: 22,
    sodium: 40,
    caffeine: 0,
    color: 'orange',
    priceZAR: 29.99,
    image: 'https://media.biogen.co.za/wp-content/uploads/6009557142113-high-energy-gel-mixed-berry-36g.jpg',
    category: 'gel',
  },

  // ============ DRINKS ============

  // Maurten Drink Mix
  {
    id: 'maurten-drink-160',
    brand: 'Maurten',
    name: 'Drink Mix 160',
    calories: 160,
    carbs: 40,
    sodium: 0,
    caffeine: 0,
    color: 'white',
    priceZAR: 50.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten_DrinkMix160_2025-bright_14d5ba43-d7bb-4422-81aa-0b01ccbe7b15.png?v=1756851258',
    category: 'drink',
  },
  {
    id: 'maurten-drink-320',
    brand: 'Maurten',
    name: 'Drink Mix 320',
    calories: 320,
    carbs: 80,
    sodium: 0,
    caffeine: 0,
    color: 'white',
    priceZAR: 75.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten_DrinkMix320_2025-bright_c2201c0a-acd0-4125-9801-1f7fee2c3bd6.png?v=1756851279',
    category: 'drink',
  },
  {
    id: 'maurten-drink-320-caf',
    brand: 'Maurten',
    name: 'Drink 320 Caf',
    calories: 320,
    carbs: 80,
    sodium: 0,
    caffeine: 100,
    color: 'white',
    priceZAR: 82.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/products/dm320c_single.jpg?v=1762198834',
    category: 'drink',
  },

  // SIS Drinks
  {
    id: 'sis-go-electrolyte',
    brand: 'SIS',
    name: 'GO Electrolyte',
    calories: 144,
    carbs: 36,
    sodium: 250,
    caffeine: 0,
    color: 'blue',
    priceZAR: 45.00,
    image: 'https://www.scienceinsport.com/media/catalog/product/s/i/sis_orange_electolyte_powder_1.6kg.png?optimize=medium&fit=bounds&height=400&width=400',
    category: 'drink',
  },
  {
    id: 'sis-beta-fuel-drink',
    brand: 'SIS',
    name: 'Beta Fuel Drink',
    calories: 320,
    carbs: 80,
    sodium: 500,
    caffeine: 0,
    color: 'blue',
    priceZAR: 65.00,
    image: 'https://www.scienceinsport.com/media/catalog/product/b/e/beta_fuel_80_orange_powder.png?optimize=medium&fit=bounds&height=400&width=400',
    category: 'drink',
  },

  // 32Gi Drinks
  {
    id: '32gi-endure',
    brand: '32Gi',
    name: 'Endure Drink',
    calories: 170,
    carbs: 42,
    sodium: 160,
    caffeine: 0,
    color: 'green',
    priceZAR: 49.90,
    image: 'https://32gi.com/cdn/shop/files/32gi-Blueberry-Endure.jpg?v=1709802078&width=400',
    category: 'drink',
  },

  // Nuun
  {
    id: 'nuun-sport',
    brand: 'Nuun',
    name: 'Sport Hydration',
    calories: 10,
    carbs: 1,
    sodium: 300,
    caffeine: 0,
    color: 'yellow',
    priceZAR: 180.00,
    image: 'https://nuunlife.com/cdn/shop/files/Nuun_Tube_Upright_withTabs_Strawberry_lemonade_web.png?v=1744037007&width=400',
    category: 'drink',
  },

  // ============ BARS ============

  // Maurten Solid
  {
    id: 'maurten-solid-160',
    brand: 'Maurten',
    name: 'Solid 160',
    calories: 160,
    carbs: 38,
    sodium: 30,
    caffeine: 0,
    color: 'white',
    priceZAR: 70.00,
    image: 'https://cdn.shopify.com/s/files/1/1515/2714/files/Maurten_Solid_160_C_OPT_dc6dd464-267d-4d00-af15-71c91f9d9a7e.png?v=1754417008',
    category: 'bar',
  },

  // USN Bars
  {
    id: 'usn-energy-oats',
    brand: 'USN',
    name: 'Energy Oats Bar',
    calories: 140,
    carbs: 20,
    sodium: 30,
    caffeine: 0,
    color: 'red',
    priceZAR: 15.99,
    image: 'https://za.usn.global/cdn/shop/files/Energy_Oats_Bar-03.webp?v=1747037523&width=400',
    category: 'bar',
  },

  // 32Gi Bars
  {
    id: '32gi-protein-bar',
    brand: '32Gi',
    name: 'Protein Bar',
    calories: 200,
    carbs: 18,
    sodium: 80,
    caffeine: 0,
    color: 'green',
    priceZAR: 45.00,
    image: 'https://32gi.co.za/cdn/shop/files/32Gi_Protein-Bar_Double-Choc-Chip-Render.jpg?v=1700537303&width=400',
    category: 'bar',
  },

  // ============ CHEWS ============

  // GU Chews
  {
    id: 'gu-energy-chews',
    brand: 'GU Energy',
    name: 'Energy Chews',
    calories: 90,
    carbs: 23,
    sodium: 50,
    caffeine: 20,
    color: 'orange',
    priceZAR: 71.99,
    image: 'https://guenergy.com/cdn/shop/files/Rainbow_Fruit_Mix_Chews_Single_774a3322-5737-4a25-b797-645f804636a2.png?v=1744311494',
    category: 'chew',
  },

  // SIS Chews
  {
    id: 'sis-go-gummies',
    brand: 'SIS',
    name: 'GO Gummies',
    calories: 88,
    carbs: 22,
    sodium: 0,
    caffeine: 0,
    color: 'blue',
    priceZAR: 40.00,
    image: 'https://www.scienceinsport.com/media/catalog/product/b/e/beta_fuel_gummies.png?optimize=medium&fit=bounds&height=400&width=400',
    category: 'chew',
  },
];

// Helper function to get products by category
export function getProductsByCategory(category: ProductProps['category']): ProductProps[] {
  return products.filter(p => p.category === category);
}

// Helper function to get all gels
export function getGels(): ProductProps[] {
  return getProductsByCategory('gel');
}

// Helper function to get all drinks
export function getDrinks(): ProductProps[] {
  return getProductsByCategory('drink');
}

// Helper function to get all bars
export function getBars(): ProductProps[] {
  return getProductsByCategory('bar');
}

// Helper function to get all chews
export function getChews(): ProductProps[] {
  return getProductsByCategory('chew');
}

// Search products by name or brand
export function searchProducts(query: string): ProductProps[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.brand.toLowerCase().includes(lowerQuery)
  );
}
