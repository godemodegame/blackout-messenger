import { StickerId } from "../types/messages";

export const stickers: Array<{
  id: StickerId;
  label: string;
  src: string;
}> = [
  {
    id: "smile-dial",
    label: "Dial Smile",
    src: "/stickers/smile-dial.svg",
  },
  {
    id: "floppy-secret",
    label: "Floppy Secret",
    src: "/stickers/floppy-secret.svg",
  },
  {
    id: "radio-heart",
    label: "Radio Heart",
    src: "/stickers/radio-heart.svg",
  },
  {
    id: "warning-star",
    label: "Warning Star",
    src: "/stickers/warning-star.svg",
  },
  {
    id: "ghost-packet",
    label: "Ghost Packet",
    src: "/stickers/ghost-packet.svg",
  },
  {
    id: "burn-after-reading",
    label: "Burn Note",
    src: "/stickers/burn-after-reading.svg",
  },
];

export function getSticker(id: StickerId) {
  return stickers.find((sticker) => sticker.id === id);
}
