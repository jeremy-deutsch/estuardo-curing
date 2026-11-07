import { UploadsScreen } from "@/components/uploads-screen";
import { staffPageSession } from "@/lib/auth";
import { importHistory, importReport } from "@/lib/data";
import { z } from "zod";
import { notFound } from "next/navigation";
export const maxDuration = 120;
export default async function UploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const { db } = await staffPageSession();
  const id = (await searchParams).import;
  if (id && !z.uuid().safeParse(id).success) notFound();
  const [history, report] = await Promise.all([
    importHistory(db),
    id ? importReport(db, id) : null,
  ]);
  if (id && !report) notFound();
  return (
    <UploadsScreen key={id || "new"} history={history} initialReport={report} />
  );
}
