import type { SponsorRequest } from './sponsorship-domain';

export type CampaignFilter = 'all' | 'pending' | 'approved' | 'active' | 'ended' | 'rejected';
export const campaignFilters: { value: CampaignFilter; label: string }[] = [
  { value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' }, { value: 'active', label: 'Activas' },
  { value: 'ended', label: 'Finalizadas' }, { value: 'rejected', label: 'Rechazadas' },
];

export function campaignState(campaign: SponsorRequest, now = Date.now()): Exclude<CampaignFilter, 'all'> {
  if (campaign.status !== 'active') return campaign.status;
  return campaign.starts_at && campaign.ends_at && Date.parse(campaign.starts_at) <= now && Date.parse(campaign.ends_at) > now ? 'active' : 'ended';
}

export function nextCampaignAction(campaign: SponsorRequest, wallet: string, recovering = false, now = Date.now()) {
  const state = campaignState(campaign, now);
  const creator = campaign.creator_wallet === wallet;
  if (state === 'pending') return creator ? 'Revisa el anuncio y decide si encaja con tu comunidad.' : 'El creador está revisando tu propuesta. Todavía no debes pagar.';
  if (state === 'approved') return creator ? 'Aprobaste la propuesta. La marca debe pagar para iniciar la publicación.' : recovering ? 'Hay un pago enviado. Verifica su firma para activar la campaña sin pagar de nuevo.' : 'Tu propuesta fue aprobada. Paga para iniciar el período de publicación.';
  if (state === 'active') return 'El anuncio está publicado. Puedes consultar el pago y la fecha de finalización.';
  if (state === 'ended') return 'El período de publicación terminó. El comprobante de pago sigue disponible.';
  return creator ? 'Rechazaste esta propuesta. No se habilitó el pago.' : 'El creador rechazó esta propuesta. No debes realizar un pago.';
}
