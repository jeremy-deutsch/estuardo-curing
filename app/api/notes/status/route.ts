import { api, staffSession } from "@/lib/auth";
import { notesReadStatus } from "@/lib/data";

export async function GET() {
  return api(async () => {
    const { db } = await staffSession();
    return notesReadStatus(db);
  });
}
