import {
  getJakartaToday,
  parseLiabilityDueDate,
  getCalendarDayDifference,
} from './periodUtils';

export interface LiabilityReminderState {
  h3Sent?: boolean;
  h1Sent?: boolean;
  dueDateSent?: boolean;
  lastEvaluatedDueDate?: string;
  updatedAt?: number;
}

export type ReminderStage = 'h3' | 'h1' | 'dueDate';

export interface ReminderDecision {
  shouldSend: boolean;
  stage?: ReminderStage;
  title?: string;
  body?: string;
  diffDays?: number;
  newReminderState?: LiabilityReminderState;
  reason?: string;
}

/**
 * Standard Privacy-Safe Notification Content
 * VERBATIM user specifications:
 * - H-3: "Ada tagihan yang jatuh tempo 3 hari lagi. Buka InputMi untuk detail."
 * - H-1: "Ada tagihan yang jatuh tempo besok. Buka InputMi untuk detail."
 * - Hari H: "Ada tagihan jatuh tempo hari ini. Buka InputMi untuk detail."
 * Title: "Pengingat InputMi"
 *
 * Strictly NO liability name, amount, bank, or category in the payload.
 */
export const REMINDER_MESSAGES: Record<ReminderStage, { title: string; body: string }> = {
  h3: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan yang jatuh tempo 3 hari lagi. Buka InputMi untuk detail.',
  },
  h1: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan yang jatuh tempo besok. Buka InputMi untuk detail.',
  },
  dueDate: {
    title: 'Pengingat InputMi',
    body: 'Ada tagihan jatuh tempo hari ini. Buka InputMi untuk detail.',
  },
};

/**
 * Evaluates whether a liability is due for a reminder today.
 * Guarantees idempotency and handles due date modifications.
 */
export function evaluateLiabilityReminder(
  liability: {
    id: string;
    name?: string;
    totalRemaining: number;
    dueDate?: string;
    reminderState?: LiabilityReminderState;
  },
  customTodayDateStr?: string
): ReminderDecision {
  // 1. If liability is paid, settled, or has no remaining balance: never send
  if (!liability || liability.totalRemaining <= 0) {
    return { shouldSend: false, reason: 'liability_settled_or_paid' };
  }

  // 2. Parse due date safely without timezone skew
  const parsedDue = parseLiabilityDueDate(liability.dueDate);
  if (!parsedDue) {
    return { shouldSend: false, reason: 'invalid_due_date_format' };
  }

  // 3. Current calendar date in Asia/Jakarta
  const todayStr = customTodayDateStr || getJakartaToday().dateString;

  // 4. Calendar difference in days (dueDate - today)
  const diffDays = getCalendarDayDifference(todayStr, parsedDue.dateString);

  // 5. Existing reminder state
  let state: LiabilityReminderState = liability.reminderState
    ? { ...liability.reminderState }
    : {};

  // If due date was changed by user, reset flags so future stages can be delivered for the new date
  if (state.lastEvaluatedDueDate && state.lastEvaluatedDueDate !== parsedDue.dateString) {
    state = {
      h3Sent: false,
      h1Sent: false,
      dueDateSent: false,
      lastEvaluatedDueDate: parsedDue.dateString,
      updatedAt: Date.now(),
    };
  } else if (!state.lastEvaluatedDueDate) {
    state.lastEvaluatedDueDate = parsedDue.dateString;
  }

  // 6. Evaluate reminder stages: H-3 (diff = 3), H-1 (diff = 1), Hari H (diff = 0)
  if (diffDays === 3) {
    if (state.h3Sent) {
      return { shouldSend: false, diffDays, reason: 'h3_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'h3',
      title: REMINDER_MESSAGES.h3.title,
      body: REMINDER_MESSAGES.h3.body,
      diffDays,
      newReminderState: {
        ...state,
        h3Sent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  if (diffDays === 1) {
    if (state.h1Sent) {
      return { shouldSend: false, diffDays, reason: 'h1_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'h1',
      title: REMINDER_MESSAGES.h1.title,
      body: REMINDER_MESSAGES.h1.body,
      diffDays,
      newReminderState: {
        ...state,
        h1Sent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  if (diffDays === 0) {
    if (state.dueDateSent) {
      return { shouldSend: false, diffDays, reason: 'dueDate_already_delivered' };
    }
    return {
      shouldSend: true,
      stage: 'dueDate',
      title: REMINDER_MESSAGES.dueDate.title,
      body: REMINDER_MESSAGES.dueDate.body,
      diffDays,
      newReminderState: {
        ...state,
        dueDateSent: true,
        lastEvaluatedDueDate: parsedDue.dateString,
        updatedAt: Date.now(),
      },
    };
  }

  return {
    shouldSend: false,
    diffDays,
    reason: diffDays < 0 ? 'due_date_passed' : 'not_in_reminder_window',
  };
}
