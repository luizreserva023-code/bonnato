import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const categoriesData = [
  { name: "Promoções", slug: "promocoes", description: "Ofertas especiais da semana", sortOrder: 1 },
  { name: "Pizzas", slug: "pizzas", description: "Nossas deliciosas pizzas artesanais", sortOrder: 2 },
  { name: "Calzones", slug: "calzones", description: "Calzones recheados e crocantes", sortOrder: 3 },
  { name: "Lasanhas", slug: "lasanhas", description: "Lasanhas caseiras irresistíveis", sortOrder: 4 },
  { name: "Empanados", slug: "empanados", description: "Empanados crocantes e saborosos", sortOrder: 5 },
  { name: "Sorvetes", slug: "sorvetes", description: "Sorvetes artesanais para sobremesa", sortOrder: 6 },
  { name: "Bebidas", slug: "bebidas", description: "Refrigerantes, sucos e mais", sortOrder: 7 },
  { name: "Extras", slug: "extras", description: "Adicionais e complementos", sortOrder: 8 },
];

console.log("🌱 Seeding categories...");
for (const cat of categoriesData) {
  await connection.execute(
    "INSERT IGNORE INTO categories (name, slug, description, sortOrder, active) VALUES (?, ?, ?, ?, 1)",
    [cat.name, cat.slug, cat.description, cat.sortOrder]
  );
}

// Get category IDs
const [catRows] = await connection.execute("SELECT id, slug FROM categories");
const catMap = {};
for (const row of catRows) {
  catMap[row.slug] = row.id;
}

console.log("Category map:", catMap);

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
const productsData = [
  // PROMOÇÕES
  { categorySlug: "promocoes", name: "Combo Família", description: "2 pizzas grandes + 1 refrigerante 2L", price: "89.90", featured: true },
  { categorySlug: "promocoes", name: "Combo Casal", description: "1 pizza grande + 1 refrigerante 1L", price: "54.90", featured: true },
  { categorySlug: "promocoes", name: "Combo Econômico", description: "1 pizza média + 1 refrigerante 600ml", price: "39.90", featured: true },

  // PIZZAS
  { categorySlug: "pizzas", name: "Margherita", description: "Molho de tomate, mussarela, tomate fresco e manjericão", price: "45.00" },
  { categorySlug: "pizzas", name: "Calabresa", description: "Molho de tomate, mussarela, calabresa e cebola", price: "47.00" },
  { categorySlug: "pizzas", name: "Frango com Catupiry", description: "Molho de tomate, frango desfiado e catupiry", price: "49.00" },
  { categorySlug: "pizzas", name: "Portuguesa", description: "Molho de tomate, mussarela, presunto, ovos, cebola e azeitona", price: "50.00" },
  { categorySlug: "pizzas", name: "Quatro Queijos", description: "Mussarela, provolone, parmesão e catupiry", price: "52.00" },
  { categorySlug: "pizzas", name: "Pepperoni", description: "Molho de tomate, mussarela e pepperoni", price: "52.00" },
  { categorySlug: "pizzas", name: "Napolitana", description: "Molho de tomate, mussarela, tomate e parmesão", price: "48.00" },
  { categorySlug: "pizzas", name: "Bacon", description: "Molho de tomate, mussarela e bacon crocante", price: "50.00" },
  { categorySlug: "pizzas", name: "Atum", description: "Molho de tomate, mussarela, atum e cebola", price: "49.00" },
  { categorySlug: "pizzas", name: "Vegetariana", description: "Molho de tomate, mussarela, pimentão, brócolis, champignon e azeitona", price: "48.00" },
  { categorySlug: "pizzas", name: "Strogonoff de Frango", description: "Strogonoff de frango, mussarela e batata palha", price: "53.00" },
  { categorySlug: "pizzas", name: "Camarão", description: "Molho de tomate, mussarela e camarão temperado", price: "62.00" },
  { categorySlug: "pizzas", name: "Chocolate", description: "Chocolate ao leite, morango e granulado", price: "45.00" },
  { categorySlug: "pizzas", name: "Romeu e Julieta", description: "Mussarela e goiabada", price: "44.00" },
  { categorySlug: "pizzas", name: "Brigadeiro", description: "Chocolate, brigadeiro e granulado", price: "46.00" },

  // CALZONES
  { categorySlug: "calzones", name: "Calzone de Frango", description: "Frango desfiado, mussarela e catupiry", price: "38.00" },
  { categorySlug: "calzones", name: "Calzone de Calabresa", description: "Calabresa, mussarela e cebola", price: "36.00" },
  { categorySlug: "calzones", name: "Calzone Quatro Queijos", description: "Mussarela, provolone, parmesão e catupiry", price: "40.00" },
  { categorySlug: "calzones", name: "Calzone de Presunto", description: "Presunto, mussarela e tomate", price: "35.00" },

  // LASANHAS
  { categorySlug: "lasanhas", name: "Lasanha Bolonhesa", description: "Massa fresca, molho bolonhesa e mussarela", price: "35.00" },
  { categorySlug: "lasanhas", name: "Lasanha de Frango", description: "Massa fresca, frango ao molho branco e mussarela", price: "35.00" },
  { categorySlug: "lasanhas", name: "Lasanha Quatro Queijos", description: "Massa fresca, quatro queijos e molho branco", price: "37.00" },

  // EMPANADOS
  { categorySlug: "empanados", name: "Frango Empanado (4 un)", description: "Pedaços de frango crocantes empanados", price: "22.00" },
  { categorySlug: "empanados", name: "Nuggets (10 un)", description: "Nuggets de frango crocantes", price: "18.00" },
  { categorySlug: "empanados", name: "Mozzarella Sticks (6 un)", description: "Palitos de mussarela empanados", price: "20.00" },

  // SORVETES
  { categorySlug: "sorvetes", name: "Sorvete de Creme", description: "Sorvete artesanal sabor creme", price: "12.00" },
  { categorySlug: "sorvetes", name: "Sorvete de Chocolate", description: "Sorvete artesanal sabor chocolate", price: "12.00" },
  { categorySlug: "sorvetes", name: "Sorvete de Morango", description: "Sorvete artesanal sabor morango", price: "12.00" },
  { categorySlug: "sorvetes", name: "Sundae", description: "Sorvete com calda de chocolate ou morango", price: "15.00" },

  // BEBIDAS
  { categorySlug: "bebidas", name: "Coca-Cola 350ml", description: "Refrigerante gelado", price: "6.00" },
  { categorySlug: "bebidas", name: "Coca-Cola 600ml", description: "Refrigerante gelado", price: "8.00" },
  { categorySlug: "bebidas", name: "Coca-Cola 1L", description: "Refrigerante gelado", price: "10.00" },
  { categorySlug: "bebidas", name: "Coca-Cola 2L", description: "Refrigerante gelado", price: "14.00" },
  { categorySlug: "bebidas", name: "Guaraná Antarctica 350ml", description: "Refrigerante gelado", price: "6.00" },
  { categorySlug: "bebidas", name: "Suco de Laranja 500ml", description: "Suco natural de laranja", price: "10.00" },
  { categorySlug: "bebidas", name: "Água Mineral 500ml", description: "Água mineral sem gás", price: "4.00" },
  { categorySlug: "bebidas", name: "Suco de Uva 1L", description: "Suco de uva integral", price: "18.00" },

  // EXTRAS
  { categorySlug: "extras", name: "Borda Recheada de Catupiry", description: "Adicione borda recheada de catupiry na sua pizza", price: "8.00" },
  { categorySlug: "extras", name: "Borda Recheada de Cheddar", description: "Adicione borda recheada de cheddar na sua pizza", price: "8.00" },
  { categorySlug: "extras", name: "Mussarela Extra", description: "Porção extra de mussarela", price: "5.00" },
  { categorySlug: "extras", name: "Molho Extra", description: "Porção extra de molho de tomate", price: "3.00" },
];

console.log("🌱 Seeding products...");
for (const p of productsData) {
  const catId = catMap[p.categorySlug];
  if (!catId) {
    console.warn(`Category not found for slug: ${p.categorySlug}`);
    continue;
  }
  await connection.execute(
    "INSERT IGNORE INTO products (categoryId, name, description, price, featured, active, sortOrder) VALUES (?, ?, ?, ?, ?, 1, 0)",
    [catId, p.name, p.description, p.price, p.featured ? 1 : 0]
  );
}

// ─── SAMPLE COUPON ────────────────────────────────────────────────────────────
console.log("🌱 Seeding sample coupon...");
await connection.execute(
  "INSERT IGNORE INTO coupons (code, discountType, discountValue, minOrderValue, maxUses, active) VALUES (?, ?, ?, ?, ?, 1)",
  ["BONATTO10", "percentage", "10.00", "30.00", 100]
);
await connection.execute(
  "INSERT IGNORE INTO coupons (code, discountType, discountValue, minOrderValue, active) VALUES (?, ?, ?, ?, 1)",
  ["FRETE5", "fixed", "5.00", "0.00"]
);

await connection.end();
console.log("✅ Seed completed successfully!");
