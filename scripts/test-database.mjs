// All fixtures and role changes are rolled back, including on failure.
import pg from "pg";
import assert from "node:assert/strict";
try {
  process.loadEnvFile(".env");
} catch {
  /* CI supplies credentials. */
}
const connectionString =
  process.env.POSTGRES_SESSION_POOLER_URL || process.env.POSTGRES_URL;
if (!connectionString)
  throw new Error(
    "Set POSTGRES_SESSION_POOLER_URL or POSTGRES_URL before running test:db.",
  );
const db = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15000,
});
const ids = {
  staff: crypto.randomUUID(),
  outsider: crypto.randomUUID(),
  voter: crypto.randomUUID(),
  otherVoter: crypto.randomUUID(),
  batch: crypto.randomUUID(),
};
const token = crypto.randomUUID().replaceAll("-", "").repeat(2);
async function denied(sql) {
  await db.query("savepoint expected_denial");
  let blocked = false;
  try {
    await db.query(sql);
  } catch {
    blocked = true;
  }
  await db.query("rollback to savepoint expected_denial");
  assert.ok(blocked, "An unauthorized operation was unexpectedly allowed");
}
try {
  await db.connect();
  await db.query("begin");
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    ids.staff,
    `test-${ids.staff}@example.invalid`,
    ids.outsider,
    `test-${ids.outsider}@example.invalid`,
  ]);
  await db.query("insert into public.staff_members(user_id) values($1)", [
    ids.staff,
  ]);
  for (const [id, first] of [
    [ids.voter, "Alex"],
    [ids.otherVoter, "Robin"],
  ]) {
    await db.query(
      "insert into public.voters(id,first_name,last_name,street,city,state,zip,latitude,longitude) values($1,$2,'Example','4600 Silver Hill Rd','Suitland','MD','20746',38.8,-76.9)",
      [id, first],
    );
  }
  await db.query(
    "insert into public.batches(id,name,kind,public_token,created_by) values($1,'Integration test','door',$2,$3)",
    [ids.batch, token, ids.staff],
  );
  await db.query(
    "insert into public.batch_voters(batch_id,voter_id) values($1,$2)",
    [ids.batch, ids.voter],
  );
  const point = (
    await db.query(
      "select extensions.st_x(location::extensions.geometry) x,extensions.st_y(location::extensions.geometry) y from public.voters where id=$1",
      [ids.voter],
    )
  ).rows[0];
  assert.equal(point.x, -76.9);
  assert.equal(point.y, 38.8);
  const identity = (
    await db.query(
      "select public.voter_identity('李','Example','4600 Silver Hill Rd','','Suitland','MD','20746') as k",
    )
  ).rows[0].k;
  assert.ok(
    identity.startsWith("李example|"),
    "Database collation must preserve Unicode names",
  );
  await db.query("set local role anon");
  await denied("select * from public.voters");
  await denied("select * from public.batches");
  await denied(`delete from public.batches where id='${ids.batch}'`);
  await denied("select * from public.import_rows");
  await denied(`select public.remove_voters(array['${ids.voter}']::uuid[])`);
  assert.equal(
    (await db.query("select public.read_public_batch('invalid') as b")).rows[0]
      .b,
    null,
  );
  const batch = (
    await db.query("select public.read_public_batch($1) as b", [token])
  ).rows[0].b;
  assert.equal(batch.voters.length, 1);
  assert.equal(batch.voters[0].id, ids.voter);
  const initial = batch.voters[0].updated_at;
  const scoped = (
    await db.query(
      "select public.set_public_status($1,$2,'cured',$3) as result",
      [token, ids.otherVoter, initial],
    )
  ).rows[0].result;
  assert.equal(scoped.error, "unavailable");
  const updated = (
    await db.query(
      "select public.set_public_status($1,$2,'interested',$3) as result",
      [token, ids.voter, initial],
    )
  ).rows[0].result;
  assert.equal(updated.status, "interested");
  const conflict = (
    await db.query(
      "select public.set_public_status($1,$2,'cured',$3) as result",
      [token, ids.voter, initial],
    )
  ).rows[0].result;
  assert.equal(conflict.error, "conflict");
  const cleared = (
    await db.query("select public.set_public_status($1,$2,null,$3) as result", [
      token,
      ids.voter,
      updated.updated_at,
    ])
  ).rows[0].result;
  assert.equal(cleared.status, null);
  await db.query("reset role");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    ids.outsider,
  ]);
  assert.equal(
    (await db.query("select count(*)::int n from public.voters")).rows[0].n,
    0,
  );
  await denied(
    "insert into public.batches(name,kind) values('Unauthorized','door')",
  );
  assert.equal(
    (
      await db.query("delete from public.batches where id=$1 returning id", [
        ids.batch,
      ])
    ).rowCount,
    0,
    "Unapproved accounts cannot delete batches",
  );
  await denied(`select public.remove_voters(array['${ids.voter}']::uuid[])`);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    ids.staff,
  ]);
  assert.equal(
    (
      await db.query("select count(*)::int n from public.voters where id=$1", [
        ids.voter,
      ])
    ).rows[0].n,
    1,
  );
  const baseRecord = {
    first_name: "Alex",
    last_name: "Example",
    street: "4600 Silver Hill Rd",
    unit: "",
    city: "Suitland",
    state: "MD",
    zip: "20746",
    phone: "",
    support_id: "Strong Support",
  };
  const importId = (
    await db.query("select public.prepare_import($1,$2) id", [
      "integration.csv",
      JSON.stringify([
        { row_number: 2, record: baseRecord, status: "pending", error: null },
        {
          row_number: 3,
          record: { ...baseRecord, first_name: "Taylor" },
          status: "pending",
          error: null,
        },
        {
          row_number: 4,
          record: { ...baseRecord, first_name: "Sam" },
          status: "pending",
          error: null,
        },
      ]),
    ])
  ).rows[0].id;
  const claimed = (
    await db.query("select * from public.claim_import_rows($1)", [importId])
  ).rows;
  assert.equal(claimed.length, 3);
  assert.equal(
    (await db.query("select * from public.claim_import_rows($1)", [importId]))
      .rows.length,
    0,
    "A leased chunk must not be claimed twice",
  );
  await db.query("select public.finish_import_rows($1)", [
    JSON.stringify(
      claimed.map((r) => ({
        id: r.id,
        ...(r.record.first_name === "Sam"
          ? { error: "No exact Census match" }
          : { latitude: 38.8, longitude: -76.9 }),
      })),
    ),
  ]);
  const outcomes = (
    await db.query(
      "select row_number,status,error from public.import_rows where import_id=$1 order by row_number",
      [importId],
    )
  ).rows;
  assert.deepEqual(
    outcomes.map((r) => r.status),
    ["duplicate", "imported", "failed"],
  );
  assert.equal(outcomes[2].error, "No exact Census match");
  const support = await db.query(
    "select first_name,support_id from public.voters where first_name in ('Alex','Taylor') and last_name='Example' and street='4600 Silver Hill Rd'",
  );
  assert.equal(support.rows.length, 2);
  assert.ok(
    support.rows.every((row) => row.support_id === "Strong Support"),
    "New imports and reuploads of existing voters retain Support ID",
  );
  const imported = claimed.find((r) => r.record.first_name === "Taylor");
  await db.query(
    "update public.import_rows set status='processing',claimed_at=now()-interval '4 minutes' where id=$1",
    [imported.id],
  );
  assert.equal(
    (await db.query("select * from public.claim_import_rows($1)", [importId]))
      .rows.length,
    1,
    "An expired lease must be resumable",
  );
  await db.query("select public.finish_import_rows($1)", [
    JSON.stringify([
      { id: imported.id, error: "Retry of already inserted row" },
    ]),
  ]);
  assert.equal(
    (
      await db.query("select status from public.import_rows where id=$1", [
        imported.id,
      ])
    ).rows[0].status,
    "imported",
    "Retries preserve original import success",
  );
  const assigned = (
    await db.query(
      "select public.assign_batch('Test assignment','phone',$1,null) id",
      [[ids.voter, ids.otherVoter]],
    )
  ).rows[0].id;
  await db.query("select public.assign_batch('ignored','phone',$1,$2)", [
    [ids.voter],
    assigned,
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.batch_voters where batch_id=$1",
        [assigned],
      )
    ).rows[0].n,
    2,
  );
  await db.query("update public.batches set active=false where id=$1", [
    ids.batch,
  ]);
  await db.query("set local role anon");
  assert.equal(
    (await db.query("select public.read_public_batch($1) as b", [token]))
      .rows[0].b,
    null,
  );
  const revoked = (
    await db.query(
      "select public.set_public_status($1,$2,'cured',$3) as result",
      [token, ids.voter, cleared.updated_at],
    )
  ).rows[0].result;
  assert.equal(revoked.error, "unavailable");
  await db.query("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.status_events where voter_id=$1",
        [ids.voter],
      )
    ).rows[0].n,
    2,
  );
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
    ids.staff,
  ]);
  assert.equal(
    (
      await db.query("select public.remove_voters($1) n", [
        [ids.voter, ids.voter],
      ])
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.batch_voters where voter_id=$1",
        [ids.voter],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query("select count(*)::int n from public.voters where id=$1", [
        ids.otherVoter,
      ])
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.status_events where batch_id=$1 and voter_id is null",
        [ids.batch],
      )
    ).rows[0].n,
    2,
    "Removing a voter preserves their contact history",
  );
  assert.equal(
    (await db.query("select public.remove_voters($1) n", [[ids.voter]])).rows[0]
      .n,
    0,
  );
  // Roll back this deletion so we can separately check voter preservation.
  const historyIds = (
    await db.query("select id from public.status_events where batch_id=$1", [
      ids.batch,
    ])
  ).rows.map((event) => event.id);
  await db.query("savepoint batch_deletion");
  assert.equal(
    (
      await db.query("delete from public.batches where id=$1 returning id", [
        ids.batch,
      ])
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.status_events where id=any($1::bigint[]) and batch_id is null and voter_id is null",
        [historyIds],
      )
    ).rows[0].n,
    2,
    "Deleting a batch preserves contact history",
  );
  await db.query("rollback to savepoint batch_deletion");
  await db.query("delete from public.batches where id=$1", [assigned]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.batch_voters where batch_id=$1",
        [assigned],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query("select count(*)::int n from public.voters where id=$1", [
        ids.otherVoter,
      ])
    ).rows[0].n,
    1,
    "Deleting a batch preserves its voters",
  );
  await db.query("delete from public.batches where id=$1", [ids.batch]);
  await db.query("set local role anon");
  assert.equal(
    (await db.query("select public.read_public_batch($1) as b", [token]))
      .rows[0].b,
    null,
  );
  assert.equal(
    (
      await db.query(
        "select public.set_public_status($1,$2,'cured',$3) as result",
        [token, ids.otherVoter, cleared.updated_at],
      )
    ).rows[0].result.error,
    "unavailable",
  );
  console.log(
    "Database integration checks passed: PostGIS, RLS, staff authorization, token scope, status conflicts, clearing, revocation, audit history, import outcomes, resumable leases, idempotency, and batch assignment.",
  );
} catch (error) {
  console.error(
    "Database integration checks failed:",
    error.code || error.message,
  );
  process.exitCode = 1;
} finally {
  try {
    await db.query("rollback");
  } catch {
    /* A failed connection has no transaction. */
  }
  await db.end();
}
