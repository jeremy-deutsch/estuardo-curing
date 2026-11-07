import { VotersScreen } from "@/components/voters-screen";
import { staffPageSession } from "@/lib/auth";
import { workspace } from "@/lib/data";
export default async function VotersPage() {
  const { db } = await staffPageSession();
  return <VotersScreen data={await workspace(db)} />;
}
