import { NotesScreen } from "@/components/notes-screen";
import { staffPageSession } from "@/lib/auth";
import { notesReadStatus, voterNotes } from "@/lib/data";
import { NotesViewTracker } from "@/components/notes-view-tracker";
import { z } from "zod";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ voter?: string | string[] }>;
}) {
  const { db } = await staffPageSession();
  const parsedVoter = z.uuid().safeParse((await searchParams).voter);
  const voterId = parsedVoter.success ? parsedVoter.data : undefined;
  const { checked_at } = await notesReadStatus(db);
  const notes = await voterNotes(db, checked_at, voterId);
  return (
    <>
      <NotesViewTracker viewedAt={checked_at} />
      <NotesScreen key={voterId || "all"} notes={notes} voterId={voterId} />
    </>
  );
}
