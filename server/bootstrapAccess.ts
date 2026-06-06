import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { drivers, users } from "../drizzle/schema";
import { getDb } from "./db";

export type BootstrapAccessInput = {
  adminEmail?: string;
  adminName?: string;
  adminPassword?: string;
  driverName?: string;
  driverPhone?: string | null;
};

export type BootstrapAccessResult = {
  admin: {
    email: string;
    password: string;
    role: "admin";
  };
  motoboy: {
    name: string;
    token: string;
    appUrl: string;
  };
};

function buildDefaultPassword(): string {
  return `Bonatto@${crypto.randomBytes(6).toString("hex")}!`;
}

export async function bootstrapAdminAndDriver(input: BootstrapAccessInput = {}): Promise<BootstrapAccessResult> {
  const db = await getDb();

  if (!db) {
    throw new Error("DATABASE_URL nao configurada ou banco indisponivel.");
  }

  const adminEmail = input.adminEmail?.trim().toLowerCase() || "admin@bonatto.local";
  const adminName = input.adminName?.trim() || "Administrador Bonatto";
  const adminPassword = input.adminPassword?.trim() || buildDefaultPassword();
  const driverName = input.driverName?.trim() || "Motoboy Bonatto";
  const driverPhone = input.driverPhone?.trim() || null;

  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  if (existingAdmin[0]) {
    await db
      .update(users)
      .set({
        name: adminName,
        passwordHash,
        loginMethod: "email",
        role: "admin",
        emailVerified: true,
        lastSignedIn: new Date(),
      })
      .where(eq(users.id, existingAdmin[0].id));
  } else {
    await db.insert(users).values({
      openId: `email_${crypto.randomBytes(16).toString("hex")}`,
      name: adminName,
      email: adminEmail,
      passwordHash,
      loginMethod: "email",
      role: "admin",
      emailVerified: true,
      lastSignedIn: new Date(),
    });
  }

  const driverToken = crypto.randomBytes(32).toString("hex");
  const existingDriver = await db.select().from(drivers).where(eq(drivers.name, driverName)).limit(1);

  if (existingDriver[0]) {
    await db
      .update(drivers)
      .set({
        name: driverName,
        phone: driverPhone,
        active: true,
        accessToken: driverToken,
      })
      .where(eq(drivers.id, existingDriver[0].id));
  } else {
    await db.insert(drivers).values({
      name: driverName,
      phone: driverPhone,
      active: true,
      accessToken: driverToken,
    });
  }

  return {
    admin: {
      email: adminEmail,
      password: adminPassword,
      role: "admin",
    },
    motoboy: {
      name: driverName,
      token: driverToken,
      appUrl: `${process.env.PUBLIC_APP_URL ?? "http://localhost:3000"}/motoboy`,
    },
  };
}
