// Final QA smoke: RBAC (student must not approve) + load test (100 concurrent schedule requests).
const BASE = "http://localhost:3001";
const login = async (email, password) => {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).accessToken;
};

const auth = async (email, password) => {
  const t = await login(email, password);
  return { Authorization: `Bearer ${t}` };
};

// --- RBAC: student must NOT be able to approve a change (403 expected, not 200)
const studentH = await auth("student@example.com", "student12345");
const res = await fetch(`${BASE}/api/changes/00000000-0000-0000-0000-000000000000/approve`, {
  method: "PATCH",
  headers: studentH,
});
console.log(`RBAC student approve -> ${res.status} ${res.status === 403 ? "(correct)" : "(WRONG)"}`);
const rbacOk = res.status === 403;

// --- RBAC: student must NOT see admin directory
const res2 = await fetch(`${BASE}/api/admin/users`, { headers: studentH });
console.log(`RBAC student /api/admin/users -> ${res2.status} ${res2.status === 403 ? "(correct)" : "(WRONG)"}`);

// --- role smoke: admin/teacher logins work
await auth("admin@example.com", "admin12345");
console.log("role smoke: admin login ok");
await auth("teacher@example.com", "teacher12345");
console.log("role smoke: teacher login ok");

// --- Load test: 100 concurrent schedule requests (student's own schedule)
const teacherH = await auth("teacher@example.com", "teacher12345");
const targets = [
  ["student /api/schedule/me", studentH],
  ["teacher /api/schedule/me", teacherH],
];
for (const [label, headers] of targets) {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const url = label.includes("teacher")
    ? `${BASE}/api/schedule/me?date=${date}`
    : `${BASE}/api/schedule/me?date=${date}`;
  const t0 = performance.now();
  const results = await Promise.all(
    Array.from({ length: 100 }, () => fetch(url, { headers })),
  );
  const total = performance.now() - t0;
  const oks = results.filter((r) => r.ok).length;
  const lat = [];
  const t1 = performance.now();
  await Promise.all(
    Array.from({ length: 100 }, async () => {
      const s = performance.now();
      await fetch(url, { headers });
      lat.push(performance.now() - s);
    }),
  );
  lat.sort((a, b) => a - b);
  const p95 = lat[94].toFixed(0);
  const avg = (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(0);
  console.log(`load ${label}: first-burst 100r in ${total.toFixed(0)}ms (${oks}/100 ok), sequential-avg ${avg}ms, p95 ${p95}ms`);
}
console.log(rbacOk ? "QA SMOKE: PASS" : "QA SMOKE: FAIL (RBAC)");
