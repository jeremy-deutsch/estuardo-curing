import { BatchesScreen } from "@/components/batches-screen";
import { staffPageSession } from "@/lib/auth";
import { workspace } from "@/lib/data";
export default async function BatchesPage() {
  const { db } = await staffPageSession();
  return <BatchesScreen data={await workspace(db)} />;
}
