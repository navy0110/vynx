import * as legacy from './alias-claim-legacy';
import * as registry from './alias-registration';
import { registryEnabled } from './alias-registry';
export { checkClaim, verifyClaimPayment } from './alias-claim-legacy';
export const buildClaim = (value: unknown, account: string, quote?: { priceLamports?: unknown; priceVersion?: unknown }) => registryEnabled() ? registry.buildRegistration(value, account, quote) : legacy.buildClaim(value, account);
export const confirmClaim = (value: unknown, account: string, signature: string) => registryEnabled() ? registry.confirmRegistration(value, account, signature) : legacy.confirmClaim(value, account, signature);
