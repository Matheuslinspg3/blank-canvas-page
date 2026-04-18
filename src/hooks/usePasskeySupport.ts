import { useEffect, useState } from "react";

/**
 * Detecta suporte a passkeys/WebAuthn no navegador atual.
 * - isSupported: API WebAuthn disponível
 * - hasPlatformAuthenticator: dispositivo tem Face ID/Touch ID/Windows Hello
 */
export function usePasskeySupport() {
  const [isSupported, setIsSupported] = useState(false);
  const [hasPlatformAuthenticator, setHasPlatformAuthenticator] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials?.create === "function";
    setIsSupported(supported);

    if (!supported) {
      setChecked(true);
      return;
    }

    window.PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable()
      .then((avail) => {
        setHasPlatformAuthenticator(avail);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  return { isSupported, hasPlatformAuthenticator, checked };
}
