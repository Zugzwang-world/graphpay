import { useState } from 'react';
import { createAdapter, DemoProvider } from '@/demo';
import { Stage } from '@/components/stage/Stage';
import { AppPlaceholder } from '@/apps/AppPlaceholder';
import { SoundPreference } from '@/components/shared/SoundPreference';

export function App() {
  const [adapter] = useState(createAdapter);
  return (
    <DemoProvider adapter={adapter}>
      <SoundPreference>
        <Stage customer={<AppPlaceholder app="customer" />} merchant={<AppPlaceholder app="merchant" />} />
      </SoundPreference>
    </DemoProvider>
  );
}
