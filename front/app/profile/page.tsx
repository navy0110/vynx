import { redirect } from "next/navigation";

export default async function LegacyProfilePage({ searchParams }: {
  searchParams: Promise<{ alias?: string }>;
}) {
  const { alias } = await searchParams;
  redirect(alias && /^[a-z0-9_]{3,30}$/i.test(alias) ? `/${alias.toLowerCase()}` : "/");
}
