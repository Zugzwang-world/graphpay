import type { Money, Order } from '@/demo/contract';
import { canRequestRefund, refundableMax } from '@/demo/rules';
import { checkAmount, cmp } from '@/lib/money';

export const MAX_REFUND_FILE_BYTES = 10 * 1024 * 1024;

export function validRefundFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return file.size <= MAX_REFUND_FILE_BYTES && (type.startsWith('image/') || type === 'application/pdf');
}

/** One gate for the wizard's required amount, reason and photo. */
export function canSubmitRefund(order: Order, amount: Money | null, reason: string, reasonConfirmed: boolean, photo: File | null): boolean {
  if (!canRequestRefund(order).ok || !amount || !reasonConfirmed || !reason.trim() || !photo || !validRefundFile(photo)) return false;
  const checked = checkAmount(amount.amount, refundableMax(order));
  return checked.ok && cmp(amount, refundableMax(order)) <= 0;
}
