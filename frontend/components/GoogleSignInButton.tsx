'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SRC = 'https://accounts.google.com/gsi/client';

// Minimal typing for the Google Identity Services global we use.
interface GoogleIdServices {
  accounts: {
    id: {
      initialize: (cfg: {
        client_id: string;
        callback: (resp: { credential?: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
}
declare global {
  interface Window {
    google?: GoogleIdServices;
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${SRC}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google script'));
    document.head.appendChild(s);
  });
}

export function GoogleSignInButton({
  onCredential,
  onError,
}: {
  onCredential: (idToken: string) => void;
  onError?: (message: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return; // not configured — render nothing
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => {
            if (resp.credential) onCredential(resp.credential);
            else onError?.('No credential returned from Google.');
          },
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
        });
      })
      .catch((e: Error) => onError?.(e.message));

    return () => {
      cancelled = true;
    };
  }, [onCredential, onError]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} className="flex justify-center" />;
}
