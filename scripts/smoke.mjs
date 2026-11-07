import assert from "node:assert/strict";
const base = process.env.APP_URL || "http://localhost:3000";
const login = await fetch(base + "/login");
assert.equal(login.status, 200);
const form = await login.text();
assert.ok(form.includes('name="email"') && form.includes('name="password"'));
console.log("Login form renders: OK");
for (const path of ["/voters", "/batches", "/uploads"]) {
  const response = await fetch(base + path, { redirect: "manual" });
  const body = await response.text();
  assert.ok(
    response.headers.get("location") === "/login" ||
      body.includes("url=/login"),
    `${path} must redirect signed-out visitors`,
  );
}
console.log("Staff pages redirect signed-out visitors: OK");
const endpoint = "/api/imports/00000000-0000-4000-8000-000000000000";
for (const method of ["GET", "POST"]) {
  const response = await fetch(base + endpoint, { method });
  assert.equal(
    response.status,
    401,
    `${method} import processing requires staff`,
  );
}
const crossOrigin = await fetch(base + endpoint, {
  method: "POST",
  headers: { origin: "https://example.invalid" },
});
assert.equal(crossOrigin.status, 403);
console.log("Import processing authentication and origin checks: OK");
const unavailable = await fetch(base + "/batch/invalid");
assert.ok((await unavailable.text()).includes("This batch link"));
for (const path of [
  "/api/workspace",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/batches",
  "/api/imports",
  "/api/public/batch/invalid",
]) {
  assert.equal(
    (await fetch(base + path)).status,
    404,
    `${path} should no longer exist`,
  );
}
console.log("Unavailable batch and removed JSON endpoints: OK");
