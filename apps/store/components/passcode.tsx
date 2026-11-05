'use client';

// The demo passcode (the relayer pays gas, so a payment is gated): typed once per browser
// tab, kept in memory and sessionStorage, sent only in the X-Demo-Passcode header.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const Ctx = createContext<() => string | undefined>(() => undefined);
const KEY = 'graphpay-store.passcode';

export function PasscodeProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    try {
      setValue(sessionStorage.getItem(KEY) ?? '');
    } catch {
      // blocked: memory only
    }
  }, []);
  const get = useMemo(() => () => (value === '' ? undefined : value), [value]);
  return (
    <Ctx.Provider value={get}>
      <label className="passcode">
        <span className="small">Demo passcode</span>
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            try {
              sessionStorage.setItem(KEY, e.target.value);
            } catch {
              // blocked: memory only
            }
          }}
        />
      </label>
      {children}
    </Ctx.Provider>
  );
}

export const usePasscode = () => useContext(Ctx);
