import { Address, isAddressEqual } from "viem";
import { LockKeyhole, Radio, ShieldCheck } from "lucide-react";
import { CachedMessage } from "../types/messages";
import { getSticker } from "../data/stickers";

export function MessageBubble({
  message,
  account,
  onDecrypt,
  decryptDisabled,
  decrypting = false,
}: {
  message: CachedMessage;
  account: Address;
  onDecrypt: (messageId: bigint) => void;
  decryptDisabled: boolean;
  decrypting?: boolean;
}) {
  const isMine = isAddressEqual(message.sender, account);
  const sticker =
    message.payload?.type === "sticker" || message.payload?.type === "mixed"
      ? getSticker(message.payload.stickerId)
      : undefined;

  return (
    <article className={`message ${isMine ? "mine" : "theirs"}`}>
      <div className="message-meta">
        <span>{isMine ? "OUT" : "IN"}</span>
        <span>#{message.id.toString()}</span>
        {message.payload?.group ? <span>{message.payload.group.name}</span> : null}
        <span>{formatTime(message.sentAt)}</span>
      </div>

      {message.payload ? (
        <div className="message-body">
          {sticker ? (
            <img className="message-sticker" src={sticker.src} alt={sticker.label} />
          ) : null}
          {"text" in message.payload && message.payload.text ? (
            <p>{message.payload.text}</p>
          ) : null}
          <div className="message-ok">
            <ShieldCheck size={14} />
            <span>decrypted locally</span>
          </div>
        </div>
      ) : (
        <div className="encrypted-shell">
          <div className="cipher-line">
            <Radio size={15} />
            <span>{message.bodyHash.slice(0, 18)}...</span>
          </div>
          {decrypting ? (
            <div className="decrypting-note">
              <LockKeyhole size={15} />
              <span>decrypting...</span>
            </div>
          ) : (
            <button
              className="retro-button"
              onClick={() => onDecrypt(message.id)}
              disabled={decryptDisabled}
              title="Decrypt this message with your local Fhenix permit"
            >
              <LockKeyhole size={15} />
              Decrypt
            </button>
          )}
          {message.decryptError ? (
            <p className="error-text">{message.decryptError}</p>
          ) : null}
        </div>
      )}
    </article>
  );
}

function formatTime(timestamp: number) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp * 1000));
}
