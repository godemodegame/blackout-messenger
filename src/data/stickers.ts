import { StickerId } from "../types/messages";

export const stickers: Array<{
  id: StickerId;
  label: string;
  src: string;
}> = [
  {
    id: "brain-blowing",
    label: "Brain Blowing",
    src: "/stickers/emojis/brain-blowing.png",
  },
  {
    id: "clown",
    label: "Clown",
    src: "/stickers/emojis/clown.png",
  },
  {
    id: "cry",
    label: "Cry",
    src: "/stickers/emojis/cry.png",
  },
  {
    id: "death",
    label: "Death",
    src: "/stickers/emojis/death.png",
  },
  {
    id: "demon",
    label: "Demon",
    src: "/stickers/emojis/demon.png",
  },
  {
    id: "hot",
    label: "Hot",
    src: "/stickers/emojis/hot.png",
  },
  {
    id: "idk",
    label: "IDK",
    src: "/stickers/emojis/idk.png",
  },
  {
    id: "laugh",
    label: "Laugh",
    src: "/stickers/emojis/laugh.png",
  },
  {
    id: "love",
    label: "Love",
    src: "/stickers/emojis/love.png",
  },
  {
    id: "puke",
    label: "Puke",
    src: "/stickers/emojis/puke.png",
  },
  {
    id: "thief",
    label: "Thief",
    src: "/stickers/emojis/thief.png",
  },
  {
    id: "tired",
    label: "Tired",
    src: "/stickers/emojis/tired.png",
  },
];

export function getSticker(id: StickerId) {
  return stickers.find((sticker) => sticker.id === id);
}
