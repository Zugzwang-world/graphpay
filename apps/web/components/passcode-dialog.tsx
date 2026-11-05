'use client';

// The passcode is typed once per browser session. It is checked against the
// server (POST /api/passcode, which signs nothing) and kept in sessionStorage.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PASSCODE_HEADER } from '@/lib/passcode-header';
import { useSite } from './site-context';

export function PasscodeDialog() {
  const { unlockOpen, settleUnlock } = useSite();
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (unlockOpen && !el.open) {
      setMessage(null);
      el.showModal();
    }
    if (!unlockOpen && el.open) el.close();
  }, [unlockOpen]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!value) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/passcode', { method: 'POST', headers: { [PASSCODE_HEADER]: value }, cache: 'no-store' });
      if (res.status === 204) {
        setValue('');
        settleUnlock(value);
      } else if (res.status === 503) {
        setMessage('Spending is switched off on this deployment (no passcode is set).');
      } else {
        setMessage('That passcode is not right.');
      }
    } catch {
      setMessage('The site did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} className="passcode-dialog" onCancel={() => settleUnlock(null)} aria-labelledby="passcode-title">
      <form onSubmit={submit} method="dialog">
        <h2 id="passcode-title">Enter the demo passcode</h2>
        <p className="muted">
          Buttons that move money, pause an agent or refund an order run on the server behind this passcode. It stays in this browser tab only.
        </p>
        <label className="visually-hidden" htmlFor="passcode-input">
          Demo passcode
        </label>
        <input
          id="passcode-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Passcode"
          autoFocus
        />
        {message ? (
          <p role="alert" className="passcode-error">
            {message}
          </p>
        ) : null}
        <div className="passcode-actions">
          <button type="button" className="btn btn-quiet" onClick={() => settleUnlock(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || value === ''}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
