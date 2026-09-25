const fs = require("fs");
const path = require("path");
const file = path.resolve(__dirname, "../drizzle/schema.ts");
let src = fs.readFileSync(file, "utf8");

src = src.replace(/from "drizzle-orm\/mysql-core";/, 'from "drizzle-orm/pg-core";');
src = src.replace(/\bmysqlTable\(/g, "pgTable(");
src = src.replace(/\bint\(([^\n]*?)\)\.autoincrement\(\)\.primaryKey\(\)/g, "serial($1).primaryKey()");
src = src.replace(/\bint\(/g, "integer(");
src = src.replace(/\.onUpdateNow\(\)/g, "");

src = src.replace(/mysqlEnum\(("[^"]+"),\s*\[([^\]]+)\]\)/gs, (_m, name, rawValues) => {
  const values = [...rawValues.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (!values.length) throw new Error("Enum sem valores: " + name);
  const union = values.map((value) => JSON.stringify(value)).join(" | ");
  const maxLen = Math.max(32, ...values.map((value) => value.length));
  return `varchar(${name}, { length: ${maxLen} }).$type<${union}>()`;
});

src = src.replace(/\bint,\r?\n/, "  integer,\n");
src = src.replace(/\bmysqlEnum,\r?\n/, "");
src = src.replace(/\bmysqlTable,\r?\n/, "  pgTable,\n");
src = src.replace(/\btext,\r?\n/, "  serial,\n  text,\n");

fs.writeFileSync(file, src);
console.log("Converted", file);
