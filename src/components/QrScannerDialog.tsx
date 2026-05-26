import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Address, getAddress, isAddress } from "viem";
import jsQR from "jsqr";
import { Camera, Upload, X } from "lucide-react";

export function QrScannerDialog({
  onClose,
  onScanAddress,
}: {
  onClose: () => void;
  onScanAddress: (address: Address) => void;
}) {
  const [notice, setNotice] = useState("Upload a QR image or scan with the camera.");
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>();

  useEffect(() => () => stopCamera(false), []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await decodeQrFile(file);
      openScannedAddress(text);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not read this QR image.");
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("Camera scanning is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setNotice("Point the camera at a wallet QR code.");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanCameraFrame();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Camera permission was not granted.");
    }
  }

  function stopCamera(updateState = true) {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (updateState) setCameraActive(false);
  }

  function scanCameraFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      frameRef.current = window.requestAnimationFrame(scanCameraFrame);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      setNotice("Could not read camera frames.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (result) {
      openScannedAddress(result.data);
      return;
    }

    frameRef.current = window.requestAnimationFrame(scanCameraFrame);
  }

  function openScannedAddress(rawValue: string) {
    const address = extractAddress(rawValue);
    if (!address) {
      setNotice("QR code found, but it does not contain an EVM wallet address.");
      return;
    }

    stopCamera();
    onScanAddress(address);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Scan wallet QR">
      <section className="qr-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Scan QR</span>
            <h2>Open wallet chat</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="qr-actions">
          <label className="retro-button qr-upload">
            <Upload size={16} />
            Upload QR
            <input accept="image/*" type="file" onChange={handleFileChange} />
          </label>
          <button
            className="retro-button"
            type="button"
            onClick={cameraActive ? () => stopCamera() : startCamera}
          >
            <Camera size={16} />
            {cameraActive ? "Stop camera" : "Use camera"}
          </button>
        </div>

        <video
          className={`qr-video ${cameraActive ? "active" : ""}`}
          muted
          playsInline
          ref={videoRef}
        />
        <div className="notice-strip">{notice}</div>
      </section>
    </div>
  );
}

async function decodeQrFile(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read this QR image.");

  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height);
  if (!result) throw new Error("No QR code was found in this image.");
  return result.data;
}

function extractAddress(value: string): Address | undefined {
  const match = value.match(/0x[a-fA-F0-9]{40}/);
  if (!match || !isAddress(match[0])) return undefined;
  return getAddress(match[0]);
}
