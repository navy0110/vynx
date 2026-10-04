import CreatorSponsorshipPage from '@/components/CreatorSponsorshipPage';

export default async function CreatorPage({ params }: { params: Promise<{ alias: string }> }) {
  const { alias } = await params;
  return <CreatorSponsorshipPage key={alias} alias={alias.toLowerCase()} />;
}
