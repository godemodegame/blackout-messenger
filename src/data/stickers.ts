import { StickerId } from "../types/messages";

export const stickers: Array<{
  id: StickerId;
  label: string;
  src: string;
}> = [
  { id: "alien", label: "Alien", src: "/stickers/emojis/alien.png" },
  { id: "angel", label: "Angel", src: "/stickers/emojis/angel.png" },
  { id: "brain-blowing", label: "Brain Blowing", src: "/stickers/emojis/brain-blowing.png" },
  { id: "celebration", label: "Celebration", src: "/stickers/emojis/celebration.png" },
  { id: "clown", label: "Clown", src: "/stickers/emojis/clown.png" },
  { id: "cry", label: "Cry", src: "/stickers/emojis/cry.png" },
  { id: "death", label: "Death", src: "/stickers/emojis/death.png" },
  { id: "demon", label: "Demon", src: "/stickers/emojis/demon.png" },
  { id: "fight", label: "Fight", src: "/stickers/emojis/fight.png" },
  { id: "fries", label: "Fries", src: "/stickers/emojis/fries.png" },
  { id: "gun", label: "Gun", src: "/stickers/emojis/gun.png" },
  { id: "hi", label: "Hi", src: "/stickers/emojis/hi.png" },
  { id: "hot", label: "Hot", src: "/stickers/emojis/hot.png" },
  { id: "idk", label: "IDK", src: "/stickers/emojis/idk.png" },
  { id: "laugh", label: "Laugh", src: "/stickers/emojis/laugh.png" },
  { id: "logo", label: "Fhenix", src: "/stickers/emojis/logo.png" },
  { id: "love", label: "Love", src: "/stickers/emojis/love.png" },
  { id: "no", label: "No", src: "/stickers/emojis/no.png" },
  { id: "puke", label: "Puke", src: "/stickers/emojis/puke.png" },
  { id: "shining", label: "Shining", src: "/stickers/emojis/shining.png" },
  { id: "sky", label: "Sky", src: "/stickers/emojis/sky.jpg" },
  { id: "thief", label: "Thief", src: "/stickers/emojis/thief.png" },
  { id: "tired", label: "Tired", src: "/stickers/emojis/tired.png" },
  { id: "yes", label: "Yes", src: "/stickers/emojis/yes.png" },
];

export function getSticker(id: StickerId) {
  return stickers.find((sticker) => sticker.id === id);
}
