export type PayloadKind =
  | 'goal_achieved'
  | 'goal_approaching'
  | 'missed_workout_premium'
  | 'greeting_premium'
  | 'missed_workout_free'
  | 'greeting_free';

export interface NotificationParams {
  daysLeft?: number;
}

export interface NotificationText {
  title: string;
  body: string;
}

const TEXTS: Record<
  PayloadKind,
  Record<'es' | 'en', (params: NotificationParams) => NotificationText>
> = {
  goal_achieved: {
    es: () => ({
      title: '¡Lo lograste! 🏆',
      body: 'Alcanzaste tu meta de peso. ¡Es momento de celebrar!',
    }),
    en: () => ({
      title: 'You did it! 🏆',
      body: 'You reached your weight goal. Time to celebrate!',
    }),
  },
  goal_approaching: {
    es: ({ daysLeft }) => ({
      title: '¡Tu meta se acerca!',
      body: `Quedan ${daysLeft} días. Vulcano revisa tu progreso contigo.`,
    }),
    en: ({ daysLeft }) => ({
      title: 'Your goal is close!',
      body: `${daysLeft} days left. Vulcano is reviewing your progress with you.`,
    }),
  },
  missed_workout_premium: {
    es: () => ({
      title: '2 días sin entrenar',
      body: 'Tu racha está en riesgo. Vulcano tiene tu plan listo.',
    }),
    en: () => ({
      title: '2 days without training',
      body: 'Your streak is at risk. Vulcano has your plan ready.',
    }),
  },
  greeting_premium: {
    es: () => ({
      title: '¡Hola, forjador! 💪',
      body: 'Vulcano está aquí. ¿Qué vamos a trabajar hoy?',
    }),
    en: () => ({
      title: 'Hey, forger! 💪',
      body: 'Vulcano is here. What are we working on today?',
    }),
  },
  missed_workout_free: {
    es: () => ({
      title: 'Te extrañamos 🔥',
      body: 'Vulcano tiene un mensaje para ti. ¿Volvemos?',
    }),
    en: () => ({
      title: 'We miss you 🔥',
      body: 'Vulcano has a message for you. Shall we get back to it?',
    }),
  },
  greeting_free: {
    es: () => ({
      title: '¡Hola, forjador! 💪',
      body: 'Vulcano está aquí. ¿Qué vamos a trabajar hoy?',
    }),
    en: () => ({
      title: 'Hey, forger! 💪',
      body: 'Vulcano is here. What are we working on today?',
    }),
  },
};

export function getNotificationText(
  kind: PayloadKind,
  lang: 'es' | 'en',
  params: NotificationParams = {}
): NotificationText {
  return TEXTS[kind][lang](params);
}
