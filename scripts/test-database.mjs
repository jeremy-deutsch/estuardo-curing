// All fixtures and role changes are rolled back, including on failure.
import pg from "pg";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  // Exercise the age migration inside this test's rollback transaction.
  const ageMigration = await readFile(
    new URL(
      "../supabase/migrations/202611090001_voter_age.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(
    ageMigration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, ""),
  );
  const statusMigration = await readFile(
    new URL(
      "../supabase/migrations/202611100001_do_not_cure_status.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(
    statusMigration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, ""),
  );
  const curedMigration = await readFile(
    new URL(
      "../supabase/migrations/202611100002_import_marked_as_cured.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query(
    curedMigration.replace(/^begin;\s*/, "").replace(/commit;\s*$/, ""),
  );
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    ids.staff,
    `test-${ids.staff}@example.invalid`,
    ids.outsider,
    `test-${ids.outsider}@example.invalid`,
  ]);
  await db.query("insert into public.staff_members(user_id) values($1)", [
    ids.staff,
  ]);
  await db.query("set local role service_role");
  assert.equal(
    (
      await db.query(
        "select user_id from public.staff_members where user_id = any($1::uuid[])",
        [[ids.staff, ids.outsider]],
      )
    ).rowCount,
    1,
    "The admin client can list staff memberships",
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await db.query(
      "insert into public.staff_members(user_id) values($1) on conflict(user_id) do update set user_id=excluded.user_id",
      [ids.outsider],
    );
  }
  await db.query("reset role");
  await db.query("delete from public.staff_members where user_id=$1", [
    ids.outsider,
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
  await denied("select * from public.staff_members");
  await denied("select * from public.voters");
  await denied("select * from public.batches");
  await denied(`delete from public.batches where id='${ids.batch}'`);
  await denied(
    `delete from public.batch_voters where batch_id='${ids.batch}' and voter_id='${ids.voter}'`,
  );
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
  await db.query("savepoint do_not_cure_status");
  const doNotCure = (
    await db.query(
      "select public.set_public_status($1,$2,'do_not_cure',$3) as result",
      [token, ids.voter, initial],
    )
  ).rows[0].result;
  assert.equal(doNotCure.status, "do_not_cure");
  const savedBatch = (
    await db.query("select public.read_public_batch($1) as b", [token])
  ).rows[0].b;
  assert.equal(savedBatch.voters[0].status, "do_not_cure");
  const clearedDoNotCure = (
    await db.query("select public.set_public_status($1,$2,null,$3) as result", [
      token,
      ids.voter,
      doNotCure.updated_at,
    ])
  ).rows[0].result;
  assert.equal(clearedDoNotCure.status, null);
  await db.query("rollback to savepoint do_not_cure_status");
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
    (await db.query("select count(*)::int n from public.staff_members")).rows[0]
      .n,
    0,
    "Unapproved accounts cannot read other accounts' staff memberships",
  );
  await denied(
    `insert into public.staff_members(user_id) values('${ids.outsider}')`,
  );
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
  assert.equal(
    (
      await db.query(
        "delete from public.batch_voters where batch_id=$1 and voter_id=$2 returning voter_id",
        [ids.batch, ids.voter],
      )
    ).rowCount,
    0,
    "Unapproved accounts cannot remove voters from batches",
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
    age: 65,
  };
  await db.query("savepoint cured_upload_checks");
  const fixtureLastName = crypto.randomUUID();
  const fixtures = (
    await db.query(
      `insert into public.voters(first_name,last_name,street,city,state,zip,latitude,longitude,status,updated_at)
       select name,$1,'123 Test St','Suitland','MD','20746',38.8,-76.9,status,'2020-01-01'
       from (values ('Missing null',null),('Missing interested','interested'),
         ('Missing not interested','not_interested'),('Missing no response','no_response'),
         ('Protected cured','cured'),('Protected do not cure','do_not_cure'),
         ('Present','interested'),('Present failed','no_response')) f(name,status)
       returning id,first_name,last_name,street,unit,city,state,zip,phone,status,updated_at`,
      [fixtureLastName],
    )
  ).rows;
  const incoming = fixtures
    .filter((v) => v.first_name.startsWith("Present"))
    .map((v, index) => ({
      row_number: index + 2,
      record: {
        ...v,
        first_name: v.first_name.toUpperCase(),
        street: "123 TEST ST.",
      },
      status: index ? "failed" : "pending",
      error: index ? "Invalid age" : null,
    }));
  // A duplicate within the file must also count as present.
  incoming.push({ ...incoming[0], row_number: 4, status: "duplicate" });
  const curedImportId = (
    await db.query("select public.prepare_import($1,$2) id", [
      "cured-check.csv",
      JSON.stringify(incoming),
    ])
  ).rows[0].id;
  const snapshot = (
    await db.query("select marked_as_cured from public.imports where id=$1", [
      curedImportId,
    ])
  ).rows[0].marked_as_cured;
  assert.deepEqual(
    snapshot
      .filter((v) => v.record.last_name === fixtureLastName)
      .map((v) => v.id)
      .sort(),
    fixtures
      .filter((v) => v.first_name.startsWith("Missing"))
      .map((v) => v.id)
      .sort(),
    "Only absent voters outside the two protected statuses are reported as cured",
  );
  const afterUpload = (
    await db.query(
      "select id,status,updated_at from public.voters where last_name=$1",
      [fixtureLastName],
    )
  ).rows;
  for (const before of fixtures) {
    const after = afterUpload.find((v) => v.id === before.id);
    const changed = before.first_name.startsWith("Missing");
    assert.equal(after.status, changed ? "cured" : before.status);
    assert.equal(
      after.updated_at.getTime() > before.updated_at.getTime(),
      changed,
    );
  }
  const repeatedId = (
    await db.query("select public.prepare_import($1,$2) id", [
      "repeat-cured-check.csv",
      JSON.stringify(incoming),
    ])
  ).rows[0].id;
  assert.deepEqual(
    (
      await db.query("select marked_as_cured from public.imports where id=$1", [
        repeatedId,
      ])
    ).rows[0].marked_as_cured,
    [],
    "Repeated uploads do not report voters who were already cured",
  );
  await db.query("delete from public.voters where id=$1", [
    fixtures.find((v) => v.first_name === "Missing null").id,
  ]);
  assert.deepEqual(
    (
      await db.query("select marked_as_cured from public.imports where id=$1", [
        curedImportId,
      ])
    ).rows[0].marked_as_cured,
    snapshot,
    "Upload reports retain cured voter details after removal",
  );
  await db.query("rollback to savepoint cured_upload_checks");

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
    "select first_name,support_id,age from public.voters where first_name in ('Alex','Taylor') and last_name='Example' and street='4600 Silver Hill Rd'",
  );
  assert.equal(support.rows.length, 2);
  assert.ok(
    support.rows.every((row) => row.support_id === "Strong Support"),
    "New imports and reuploads of existing voters retain Support ID",
  );
  assert.ok(
    support.rows.every((row) => row.age === 65),
    "New imports store age and duplicate imports fill missing ages",
  );
  for (const age of [null, 70]) {
    const repeatId = (
      await db.query("select public.prepare_import($1,$2) id", [
        "age-reupload.csv",
        JSON.stringify([
          {
            row_number: 2,
            record: { ...baseRecord, age },
            status: "pending",
            error: null,
          },
        ]),
      ])
    ).rows[0].id;
    const repeatRows = (
      await db.query("select * from public.claim_import_rows($1)", [repeatId])
    ).rows;
    await db.query("select public.finish_import_rows($1)", [
      JSON.stringify(
        repeatRows.map((row) => ({ id: row.id, error: "Duplicate" })),
      ),
    ]);
    assert.equal(
      (await db.query("select age from public.voters where id=$1", [ids.voter]))
        .rows[0].age,
      65,
      "Blank or different ages never overwrite an existing age",
    );
  }
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
  await db.query("savepoint batch_voter_removal");
  const voterBeforeRemoval = (
    await db.query("select * from public.voters where id=$1", [ids.voter])
  ).rows;
  const historyBeforeRemoval = (
    await db.query(
      "select * from public.status_events where voter_id=$1 order by id",
      [ids.voter],
    )
  ).rows;
  assert.equal(
    (
      await db.query(
        "delete from public.batch_voters where batch_id=$1 and voter_id=$2 returning voter_id",
        [ids.batch, ids.voter],
      )
    ).rowCount,
    1,
    "Staff can remove a voter from a batch",
  );
  assert.deepEqual(
    (await db.query("select * from public.voters where id=$1", [ids.voter]))
      .rows,
    voterBeforeRemoval,
    "Removing a batch membership preserves the voter and status",
  );
  assert.deepEqual(
    (
      await db.query(
        "select * from public.status_events where voter_id=$1 order by id",
        [ids.voter],
      )
    ).rows,
    historyBeforeRemoval,
    "Removing a batch membership preserves contact history",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.batch_voters where batch_id=$1 and voter_id=$2",
        [assigned, ids.voter],
      )
    ).rows[0].n,
    1,
    "The voter's other batch assignments remain intact",
  );
  await db.query("set local role anon");
  assert.deepEqual(
    (await db.query("select public.read_public_batch($1) as b", [token]))
      .rows[0].b.voters,
    [],
    "The volunteer view no longer includes the removed voter",
  );
  assert.equal(
    (
      await db.query(
        "select public.set_public_status($1,$2,'cured',$3) as result",
        [token, ids.voter, cleared.updated_at],
      )
    ).rows[0].result.error,
    "unavailable",
    "The batch link cannot update voters removed from the batch",
  );
  await db.query("rollback to savepoint batch_voter_removal");
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
