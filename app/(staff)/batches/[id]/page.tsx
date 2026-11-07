import { Suspense } from "react";
import { BatchDetail } from "@/components/batch-detail";
import { staffPageSession } from "@/lib/auth";
import { staffBatch } from "@/lib/data";
import { notFound } from "next/navigation";
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await staffPageSession();
  const data = await staffBatch(db, (await params).id);
  if (!data) notFound();
  return <BatchDetail batch={data.batch} content={data.content} />;
}
export default function BatchDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p>Opening batch…</p>}>
      <Detail {...props} />
    </Suspense>
  );
}
