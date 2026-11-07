import styles from "../../../components/shared.module.css";
import { Suspense } from "react";
import { PublicBatchView } from "@/components/public-batch";
import { publicBatch } from "@/lib/data";
import { notFound } from "next/navigation";
async function Batch({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await publicBatch(token);
  if (!data) notFound();
  return <PublicBatchView token={token} batch={data} />;
}
export default function BatchPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className={styles.standaloneState}>Opening your batch…</main>
      }
    >
      <Batch {...props} />
    </Suspense>
  );
}
