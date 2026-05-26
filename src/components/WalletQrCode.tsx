import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function WalletQrCode({ value }: { value: string }) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: {
        dark: "#070707",
        light: "#fffef2",
      },
    }).then((src) => {
      if (!cancelled) setQrSrc(src);
    });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="wallet-qr" aria-label="Wallet address QR code">
      {qrSrc ? <img src={qrSrc} alt="Wallet address QR code" /> : <span>Generating QR...</span>}
    </div>
  );
}
