import { describe, it, expect, vi } from 'vitest';
import { isValidUid, priceIdFor, resolvePromo, createCheckoutSession, requestOrigin } from './checkout';

const UID = '123e4567-e89b-42d3-a456-426614174000';

function fakeStripe(overrides: Record<string, unknown> = {}) {
  return {
    promotionCodes: { list: vi.fn().mockResolvedValue({ data: [{ id: 'promo_123' }] }) },
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/x' }) },
    },
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('isValidUid', () => {
  it('acepta un UUID válido', () => expect(isValidUid(UID)).toBe(true));
  it('rechaza basura', () => {
    expect(isValidUid('DROP TABLE')).toBe(false);
    expect(isValidUid(undefined)).toBe(false);
    expect(isValidUid(42)).toBe(false);
  });
});

describe('priceIdFor', () => {
  it('devuelve el env correcto por billing', () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    process.env.STRIPE_PRICE_YEARLY = 'price_y';
    expect(priceIdFor('monthly')).toBe('price_m');
    expect(priceIdFor('yearly')).toBe('price_y');
  });
  it('lanza si falta el env', () => {
    delete process.env.STRIPE_PRICE_MONTHLY;
    expect(() => priceIdFor('monthly')).toThrow();
  });
});

describe('resolvePromo', () => {
  it('devuelve el id cuando el código existe', async () => {
    expect(await resolvePromo(fakeStripe(), 'VULCANO20')).toBe('promo_123');
  });
  it('devuelve null cuando no existe (no bloquea)', async () => {
    const s = fakeStripe({ promotionCodes: { list: vi.fn().mockResolvedValue({ data: [] }) } });
    expect(await resolvePromo(s, 'NADA')).toBeNull();
  });
});

describe('requestOrigin', () => {
  it('usa el header host del request (no la dirección de bind del server)', () => {
    const h = new Headers({ host: '192.168.1.109:3000' });
    expect(requestOrigin(h, 'http://0.0.0.0:3000')).toBe('http://192.168.1.109:3000');
  });
  it('prefiere x-forwarded-host y x-forwarded-proto detrás de proxy', () => {
    const h = new Headers({
      host: 'internal:3000',
      'x-forwarded-host': 'pay.forja.fit',
      'x-forwarded-proto': 'https',
    });
    expect(requestOrigin(h, 'http://0.0.0.0:3000')).toBe('https://pay.forja.fit');
  });
  it('cae al fallback si no hay host', () => {
    expect(requestOrigin(new Headers(), 'http://localhost:3000')).toBe('http://localhost:3000');
  });
});

describe('createCheckoutSession', () => {
  it('arma la sesión con uid en las tres metadatas y URLs correctas', async () => {
    process.env.STRIPE_PRICE_YEARLY = 'price_y';
    const s = fakeStripe();
    const { url } = await createCheckoutSession(s, 'http://localhost:3000', {
      billing: 'yearly',
      uid: UID,
    });
    expect(url).toBe('https://checkout.stripe.com/x');
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.mode).toBe('subscription');
    expect(arg.line_items).toEqual([{ price: 'price_y', quantity: 1 }]);
    expect(arg.client_reference_id).toBe(UID);
    expect(arg.metadata.user_id).toBe(UID);
    expect(arg.subscription_data.metadata.user_id).toBe(UID);
    expect(arg.payment_method_collection).toBe('if_required');
    expect(arg.allow_promotion_codes).toBe(true);
    expect(arg.success_url).toBe('http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}');
    expect(arg.cancel_url).toContain(`uid=${UID}`);
  });
  it('pre-aplica el promo cuando existe (discounts sustituye allow_promotion_codes)', async () => {
    process.env.STRIPE_PRICE_MONTHLY = 'price_m';
    const s = fakeStripe();
    await createCheckoutSession(s, 'http://localhost:3000', {
      billing: 'monthly',
      uid: UID,
      promo: 'VULCANO20',
    });
    const arg = s.checkout.sessions.create.mock.calls[0][0];
    expect(arg.discounts).toEqual([{ promotion_code: 'promo_123' }]);
    expect(arg.allow_promotion_codes).toBeUndefined();
  });
});
