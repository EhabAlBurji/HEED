// Avatar library — yarn/crochet style images with colored backgrounds.
// Stored as `avatar:<key>` so we can distinguish from uploaded URLs.
//
// Images live in `public/avatars/<key>.png`. The colored background is part
// of the image, but we also keep a `bg` fallback for placeholder cases.

export type AvatarOption = {
  key: string;
  image: string;     // public path
  bg: string;        // background color (matches image bg for placeholder)
  label: string;
};

export const AVATAR_PREFIX = "avatar:";

// 12 يارن/كروشيه avatars + emoji extras for variety
export const YARN_AVATARS: AvatarOption[] = [
  { key: "notebook", image: "/avatars/notebook.png", bg: "#FFF7B8", label: "دفتر" },
  { key: "dog",      image: "/avatars/dog.png",      bg: "#A4C8F0", label: "كلب" },
  { key: "bulb",     image: "/avatars/bulb.png",     bg: "#FFF3B0", label: "فكرة" },
  { key: "house",    image: "/avatars/house.png",    bg: "#C5DDF5", label: "بيت" },
  { key: "bike",     image: "/avatars/bike.png",     bg: "#E5F0A8", label: "دراجة" },
  { key: "carrot",   image: "/avatars/carrot.png",   bg: "#D9ECC4", label: "جزرة" },
  { key: "book",     image: "/avatars/book.png",     bg: "#F5D6B2", label: "كتاب" },
  { key: "coffee",   image: "/avatars/coffee.png",   bg: "#DDE5C5", label: "قهوة" },
  { key: "clock",    image: "/avatars/clock.png",    bg: "#FFE5A6", label: "ساعة" },
  { key: "fork",     image: "/avatars/fork.png",     bg: "#FFF5A6", label: "طعام" },
  { key: "heart",    image: "/avatars/heart.png",    bg: "#F8B8E1", label: "قلب" },
  { key: "soccer",   image: "/avatars/soccer.png",   bg: "#B8E89A", label: "كرة قدم" },
];

export const ALL_AVATARS: AvatarOption[] = [...YARN_AVATARS];

// Backwards-compat exports (Settings/Projects import these names)
export const PEOPLE_AVATARS = ALL_AVATARS;
export const PROJECT_AVATARS = ALL_AVATARS;

export function findAvatar(value: string | null | undefined): AvatarOption | null {
  if (!value || !value.startsWith(AVATAR_PREFIX)) return null;
  const key = value.slice(AVATAR_PREFIX.length);
  return ALL_AVATARS.find((a) => a.key === key) ?? null;
}

export function avatarValue(key: string): string {
  return `${AVATAR_PREFIX}${key}`;
}

export function isAvatarValue(value: string | null | undefined): boolean {
  return !!value && value.startsWith(AVATAR_PREFIX);
}
