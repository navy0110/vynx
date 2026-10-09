// Retry verification only. Never rebuild or send a payment from this helper.
export async function confirmPayment<T>(verify: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await verify(); }
    catch (reason) {
      const pending = reason instanceof Error && 'code' in reason && reason.code === 'PAYMENT_PENDING';
      if (!pending || attempt >= 9) throw reason;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
}
