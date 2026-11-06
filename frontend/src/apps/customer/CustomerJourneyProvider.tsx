import { createContext, useContext, useReducer, useRef, type ReactNode } from 'react';
import { useDemo, useDemoEvents } from '@/demo/DemoProvider';
import { useSoundPreference } from '@/components/shared/SoundPreference';
import { usePrefersReducedMotion } from '@/lib/useViewport';
import { copy } from '@/copy';
import { customerJourneyReducer, initialCustomerJourney, type CustomerJourneyState } from './journey';

interface CustomerJourneyContextValue {
  state: CustomerJourneyState;
  send: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  setSheetOpen: (open: boolean) => void;
  selectOrder: (orderId: string) => void;
}
const CustomerJourneyContext = createContext<CustomerJourneyContextValue | null>(null);

export function CustomerJourneyProvider({ children }: { children: ReactNode }) {
  const { adapter } = useDemo();
  const { playWee } = useSoundPreference();
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(customerJourneyReducer, initialCustomerJourney);
  const pending = useRef(false);
  useDemoEvents((event) => {
    if (event.type === 'payment.settled' || event.type === 'payment.refused' || event.type === 'error' || event.type === 'demo.reset') pending.current = false;
    dispatch({ kind: 'event', event });
  });

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || state.running || pending.current) return;
    pending.current = true;
    dispatch({ kind: 'send', text: trimmed, at: Date.now() });
    if (!reduced) playWee();
    try { await adapter.sendPrompt(trimmed); }
    catch (error) { pending.current = false; dispatch({ kind: 'localError', message: error instanceof Error ? error.message : copy.common.errorGeneric }); }
  };
  const retry = async () => {
    if (!state.lastPrompt || state.running || pending.current) return;
    pending.current = true;
    dispatch({ kind: 'retry' });
    try { await adapter.sendPrompt(state.lastPrompt); }
    catch (error) { pending.current = false; dispatch({ kind: 'localError', message: error instanceof Error ? error.message : copy.common.errorGeneric }); }
  };
  return <CustomerJourneyContext.Provider value={{ state, send, retry, setSheetOpen: (open) => dispatch({ kind: 'sheet', open }), selectOrder: (orderId) => dispatch({ kind: 'selectOrder', orderId }) }}>{children}</CustomerJourneyContext.Provider>;
}

export function useCustomerJourney(): CustomerJourneyContextValue {
  const value = useContext(CustomerJourneyContext);
  if (!value) throw new Error('CustomerJourneyProvider is required');
  return value;
}
