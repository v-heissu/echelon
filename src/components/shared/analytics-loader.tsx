'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { isAnalyticsAllowed } from './cookie-banner';

/**
 * Dynamically loads the Umami analytics script ONLY after the user
 * has given consent (consent=all or custom with analytics=true).
 *
 * Renders nothing and loads no scripts until consent is granted.
 * Listens for `cookie-consent-change` events so it reacts immediately
 * when the user clicks "Accetta tutti" without needing a page reload.
 */
export function AnalyticsLoader() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Check on mount
    setAllowed(isAnalyticsAllowed());

    // React to consent changes
    function handleConsentChange() {
      setAllowed(isAnalyticsAllowed());
    }
    window.addEventListener('cookie-consent-change', handleConsentChange);
    return () => window.removeEventListener('cookie-consent-change', handleConsentChange);
  }, []);

  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';

  if (!allowed || !websiteId) return null;

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}
