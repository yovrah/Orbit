import { Wifi, WifiOff, Radio, MonitorPlay, Mouse } from 'lucide-react';
import { useOrbit } from '../../../state/OrbitContext';

interface ConnectivityWidgetProps {
  onNavigateStream: () => void;
  onNavigateTransfer: () => void;
  onNavigateMouse: () => void;
}

/** iOS Control-Center-style 2x2 circle group, but every circle is real:
 * connection status (opens Settings), Stream, Transfer and Mouse. No
 * decorative airplane/bluetooth toggles that silently do nothing to the PC. */
export function ConnectivityWidget({
  onNavigateStream,
  onNavigateTransfer,
  onNavigateMouse,
}: ConnectivityWidgetProps) {
  const { isReady, openSettings } = useOrbit();

  return (
    <div className="grid h-full grid-cols-2 place-items-center gap-2 p-1">
      <button
        type="button"
        onClick={openSettings}
        className={`cc-circle-btn ${isReady ? 'blue' : 'inactive'}`}
        aria-label={isReady ? 'Connected — open settings' : 'Offline — open settings'}
      >
        {isReady ? <Wifi size={22} /> : <WifiOff size={22} />}
      </button>

      <button type="button" onClick={onNavigateStream} className="cc-circle-btn green" aria-label="Screen stream">
        <MonitorPlay size={22} />
      </button>

      <button type="button" onClick={onNavigateTransfer} className="cc-circle-btn blue-soft" aria-label="File transfer">
        <Radio size={22} />
      </button>

      <button type="button" onClick={onNavigateMouse} className="cc-circle-btn purple" aria-label="Mouse">
        <Mouse size={22} />
      </button>
    </div>
  );
}
