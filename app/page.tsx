import { redirect } from "next/navigation";
import { Suspense } from "react";

async function Entry({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const params = await searchParams;
  // Default Supabase confirmation emails return to the project's Site URL.
  if (params.code)
    redirect(`/auth/callback?code=${encodeURIComponent(params.code)}`);
  if (params.error) redirect("/login?confirmation=failed");
  return redirect("/voters");
}

export default function Home(props: {
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<p>Opening workspace…</p>}>
      <Entry {...props} />
    </Suspense>
  );
}
