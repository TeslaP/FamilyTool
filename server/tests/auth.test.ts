import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers.js";

let app: any;

beforeAll(() => {
  const testApp = createTestApp();
  app = testApp.app;
});

describe("POST /api/auth/login", () => {
  it("returns JWT token with valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "testpass" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 with invalid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });

  it("returns 400 with missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin" });

    expect(res.status).toBe(400);
  });
});

describe("Auth middleware", () => {
  it("allows access with valid token", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin", password: "testpass" });

    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/categories")
      .set("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
  });
});
