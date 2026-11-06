import { useEffect, useState } from 'react';
import { story } from '@/data/story';

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: story.city.timeZone, hour: 'numeric', minute: '2-digit', hourCycle: 'h12' });

/** The phone clock: city time, iOS style ("9:41", no am/pm). */
export function useCityClock(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);
  return fmt.format(now).replace(/\s?(am|pm)$/i, '');
}
