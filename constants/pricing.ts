// Precios en MXN — única fuente de verdad. No dupliques estos montos en los
// locales; los JSON de i18n solo interpolan `{{price}}` con estos valores.
export const PRICE_FREE = '$0';
export const PRICE_MONTHLY = '$219';
export const PRICE_YEARLY = '$1,579';
export const PRICE_MONTHLY_MXN = `${PRICE_MONTHLY} MXN`;
export const PRICE_YEARLY_MXN = `${PRICE_YEARLY} MXN`;
// $1,579 / 12 ≈ $131.6 → display redondeado
export const PRICE_YEARLY_MONTHLY_EQUIVALENT = '$132';

// Paquete de créditos consumibles — compra única, sin suscripción.
// Precio placeholder, ajustar antes de lanzar.
export const CREDIT_PACK_ID = 'pack_3';
export const CREDIT_PACK_SIZE = 3;
export const CREDIT_PACK_PRICE = '$99';
export const CREDIT_PACK_PRICE_MXN = `${CREDIT_PACK_PRICE} MXN`;
