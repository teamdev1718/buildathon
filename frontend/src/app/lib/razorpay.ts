type Options = Record<string, unknown>;
type Checkout = { open(): void };
declare global {
  interface Window { Razorpay?: new (options: Options) => Checkout }
}

export type CheckoutResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window. Check your connection and try again.'));
    document.head.appendChild(script);
  });
}

/** Opens Razorpay's checkout. Resolves with the signed result, or null if the person closed the window. */
export async function openCheckout(options: Options) {
  await loadCheckout();
  return new Promise<CheckoutResult | null>(resolve => {
    const checkout = new window.Razorpay!({ ...options, handler: (result: CheckoutResult) => resolve(result), modal: { ondismiss: () => resolve(null) } });
    checkout.open();
  });
}
