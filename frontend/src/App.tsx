import { useState } from 'react';
import { createAdapter, DemoProvider } from '@/demo';
import { EngineConsole } from '@/components/stage/EngineConsole';

/** F1: the mock engine console. F2 replaces this with the two-phone stage. */
export function App() {
  const [adapter] = useState(createAdapter);
  return (
    <DemoProvider adapter={adapter}>
      <EngineConsole />
    </DemoProvider>
  );
}
