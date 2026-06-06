/**
 * Seed script: cria a loja padrão "Mateus Leme" e migra dados existentes
 * Uso: node scripts/seed-stores.mjs
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await createConnection(process.env.DATABASE_URL);

console.log("🏪 Criando loja padrão: Mateus Leme...");

// 1. Inserir loja padrão (se não existir)
const [existing] = await db.execute("SELECT id FROM stores WHERE slug = 'mateus-leme' LIMIT 1");
let storeId;

if (existing.length === 0) {
  const [result] = await db.execute(
    `INSERT INTO stores (name, slug, city, address, phone, active, isDefault, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
    [
      "Bonatto Pizza - Mateus Leme",
      "mateus-leme",
      "Mateus Leme",
      "Rua Principal, Centro - Mateus Leme/MG",
      "(37) 99999-9999",
    ]
  );
  storeId = result.insertId;
  console.log(`✅ Loja criada com ID: ${storeId}`);
} else {
  storeId = existing[0].id;
  console.log(`ℹ️  Loja já existe com ID: ${storeId}`);
}

// 2. Migrar orders existentes sem storeId
const [ordersUpdated] = await db.execute(
  "UPDATE orders SET storeId = ? WHERE storeId IS NULL",
  [storeId]
);
console.log(`📦 ${ordersUpdated.affectedRows} pedidos migrados para a loja ${storeId}`);

// 3. Migrar drivers existentes sem storeId
const [driversUpdated] = await db.execute(
  "UPDATE drivers SET storeId = ? WHERE storeId IS NULL",
  [storeId]
);
console.log(`🛵 ${driversUpdated.affectedRows} motoboys migrados para a loja ${storeId}`);

// 4. Produtos: deixar como null (global) — compartilhados entre lojas por padrão
console.log("📋 Produtos mantidos como globais (storeId = null = compartilhado entre lojas)");

console.log("\n✅ Seed concluído com sucesso!");
await db.end();
