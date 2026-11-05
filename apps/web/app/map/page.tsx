import type { Metadata } from 'next';
import { story } from '@graphpay/config';
import { MapView } from '@/components/map-view';

export const metadata: Metadata = { title: 'Map' };

export default function MapPage() {
  const radius = (story.locations as { searchRadiusKm?: number }).searchRadiusKm ?? 3;
  return (
    <div className="page page-wide">
      <h1>The shops around you, and who is open</h1>
      <p className="muted">
        Our own drawing of the neighbourhoods; no map tiles are loaded. Every dot is a shop in the directory on Arkiv, and clicking it opens its record. A shop glows while
        its Open toggle is on, an agent glows while it is at work, and both fade when their heartbeat lapses. Neighbourhood names link to their OpenStreetMap source.
      </p>
      <p>
        <span className="chip" data-tone="synthetic">
          the small city is synthetic
        </span>
      </p>
      <MapView radiusKm={radius} />
    </div>
  );
}
