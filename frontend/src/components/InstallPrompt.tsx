import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Share, Plus, X, Download } from 'lucide-react';
import { Portal } from './Portal';
import { db } from '../db/clientDb';

const DISMISS_KEY = 'install_prompt_dismissed';

/** Re-open the install sheet on demand (e.g. from Settings) — dismissing the
 * first-run nudge is permanent, so users need a way back to the instructions. */
export const SHOW_INSTALL_EVENT = 'orbit:show-install';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

interface InstallPromptProps {
  /** Gate for the automatic first-open nudge (e.g. "user has a paired PC").
   * The Settings-triggered SHOW_INSTALL_EVENT works regardless. */
  enabled?: boolean;
}

/** First-open nudge to add Orbit to the home screen. iOS Safari can't trigger a
 * native install, so we show the Share → Add to Home Screen steps; Android/Chrome
 * fires `beforeinstallprompt`, which we defer and fire from an Install button.
 * Hidden once installed (standalone) or dismissed. */
export function InstallPrompt({ enabled = true }: InstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    const onShowRequest = () => setVisible(true);
    window.addEventListener(SHOW_INSTALL_EVENT, onShowRequest);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener(SHOW_INSTALL_EVENT, onShowRequest);
    };
  }, []);

  // Auto-nudge only when allowed, not dismissed before, and after a short beat
  // so it doesn't fight the app's first paint.
  useEffect(() => {
    if (!enabled || isStandalone()) return;
    let cancelled = false;
    let timer: number | undefined;
    db.settings.get(DISMISS_KEY).then((row) => {
      if (cancelled || row?.value) return;
      timer = window.setTimeout(() => {
        // On desktop with no install event and no iOS, there's nothing to guide.
        if (isIOS || 'onbeforeinstallprompt' in window) setVisible(true);
      }, 1200);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [enabled]);

  const dismiss = () => {
    setVisible(false);
    db.settings.put({ key: DISMISS_KEY, value: 'true' });
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  if (!visible) return null;

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[75] bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
      >
        <motion.div
          className="w-full max-w-[430px] rounded-t-[32px] p-6 pb-8 flex flex-col gap-4 bg-[var(--phone-bg)] border border-black/5"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start">
            <img src="icons/icon-512x512.png" alt="Orbit" width={48} height={48} className="rounded-[14px]" />
            <button
              type="button"
              onClick={dismiss}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div>
            <h2 className="m-0 text-xl font-black text-var-ink">Add Orbit to your Home Screen</h2>
            <p className="mt-2 mb-0 text-[13px] leading-relaxed font-semibold text-[#8c94a0]">
              Install it once and Orbit opens like a real full-screen app — no browser bars, right from your home screen.
            </p>
          </div>

          {isIOS ? (
            <div className="flex flex-col gap-2">
              <div className="install-step">
                <span className="install-step-ico"><Share size={17} /></span>
                <span>
                  Tap the <strong>Share</strong> button in your browser's toolbar
                </span>
              </div>
              <div className="install-step">
                <span className="install-step-ico"><Plus size={17} /></span>
                <span>
                  Choose <strong>“Add to Home Screen”</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="mt-2 h-12 rounded-2xl bg-[#007aff] text-white text-sm font-black active:scale-95 transition-transform"
              >
                Got it
              </button>
            </div>
          ) : deferred ? (
            <button
              type="button"
              onClick={install}
              className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#007aff] text-white text-sm font-black active:scale-95 transition-transform"
            >
              <Download size={18} />
              <span>Install Orbit</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="install-step">
                <span className="install-step-ico"><Plus size={17} /></span>
                <span>
                  Open the browser menu <strong>(⋮)</strong> and choose <strong>“Add to Home screen”</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="mt-2 h-12 rounded-2xl bg-[#007aff] text-white text-sm font-black active:scale-95 transition-transform"
              >
                Got it
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </Portal>
  );
}
