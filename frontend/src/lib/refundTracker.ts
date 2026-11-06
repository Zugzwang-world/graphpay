import type { RefundStatus } from '@/demo/contract';
import type { TrackerStep } from '@/components/shared/StatusTracker';
import { copy } from '@/copy';

const sequence = ['requested', 'accepted', 'refunded'] as const;

export function refundTrackerSteps(status?: RefundStatus): TrackerStep[] {
  return sequence.map((name, index) => {
    let state: TrackerStep['state'] = 'todo';
    if (status === 'declined') state = index === 0 ? 'failed' : 'todo';
    else if (status === 'requested') state = index === 0 ? 'current' : 'todo';
    else if (status === 'accepted') state = index <= 1 ? 'done' : 'current';
    else if (status === 'refunded') state = 'done';
    return { id: name, label: copy.status[name], state };
  });
}
