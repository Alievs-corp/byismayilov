import { randomBytes } from "node:crypto";

process.env.E2E_OWNER_PASSWORD ??= randomBytes(18).toString("base64url");

export const e2eOwner = {
  name: "E2E Owner",
  email: "e2e-owner@byismayilov.test",
  password: process.env.E2E_OWNER_PASSWORD,
};
