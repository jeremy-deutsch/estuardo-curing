import { readFile } from "node:fs/promises";
import pg from "pg";
try {
  process.loadEnvFile(".env");
} catch {
  /* CI supplies environment variables. */
}
const connectionString =
  process.env.POSTGRES_SESSION_POOLER_URL || process.env.POSTGRES_URL;
if (!connectionString)
  throw new Error(
    "Set POSTGRES_SESSION_POOLER_URL or POSTGRES_URL in .env before running db:migrate.",
  );
const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  const existing = await client.query(
    "select to_regclass('public.voters') as voters, to_regclass('public.staff_members') as staff",
  );
  if (process.argv.includes("--check")) {
    console.log(
      existing.rows[0].voters
        ? "Ballot operations schema exists."
        : "Ballot operations schema not yet installed.",
    );
  } else {
    if (Boolean(existing.rows[0].voters) !== Boolean(existing.rows[0].staff))
      throw new Error(
        "Tables already exist. Review the schema before applying this first migration again.",
      );
    if (!existing.rows[0].voters)
      await client.query(
        await readFile(
          new URL(
            "../supabase/migrations/202611070001_ballot_operations.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611070002_remove_voters.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611070003_delete_batches.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611070004_supporters.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611070005_staff_management_grants.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611090001_voter_age.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611100001_do_not_cure_status.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await client.query(
      await readFile(
        new URL(
          "../supabase/migrations/202611100002_import_marked_as_cured.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    console.log(
      "Ballot operations schema installed. Grant staff membership as described in README.md.",
    );
  }
} catch (error) {
  console.error(
    "Migration failed:",
    error.code ||
      error.message.replace(
        /postgres(?:ql)?:\/\/\S+/g,
        "[redacted connection]",
      ),
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
