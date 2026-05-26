import { StickerId } from "../types/messages";
import { stickers } from "../data/stickers";

export function StickerPicker({
  selected,
  onSelect,
}: {
  selected?: StickerId;
  onSelect: (stickerId?: StickerId) => void;
}) {
  return (
    <div className="sticker-tray" aria-label="Sticker picker">
      {stickers.map((sticker) => (
        <button
          className={`sticker-button ${selected === sticker.id ? "selected" : ""}`}
          key={sticker.id}
          onClick={() => onSelect(selected === sticker.id ? undefined : sticker.id)}
          title={sticker.label}
          type="button"
        >
          <img src={sticker.src} alt={sticker.label} />
        </button>
      ))}
    </div>
  );
}
