import "server-only";

import { randomInt } from "node:crypto";

export const USERNAME_ADJECTIVES = [
  "Active",
  "Agile",
  "Alert",
  "Ample",
  "Awake",
  "Bold",
  "Brave",
  "Brisk",
  "Calm",
  "Cheerful",
  "Clever",
  "Cozy",
  "Crisp",
  "Curious",
  "Dapper",
  "Eager",
  "Fair",
  "Fresh",
  "Friendly",
  "Gentle",
  "Glad",
  "Golden",
  "Grand",
  "Happy",
  "Hardy",
  "Helpful",
  "Honest",
  "Jolly",
  "Joyful",
  "Keen",
  "Kind",
  "Lively",
  "Loyal",
  "Lucky",
  "Merry",
  "Mild",
  "Neat",
  "Nimble",
  "Noble",
  "Peppy",
  "Polite",
  "Proud",
  "Quick",
  "Quiet",
  "Ready",
  "Royal",
  "Shiny",
  "Smart",
  "Sunny",
  "Super",
  "Sweet",
  "Swift",
  "Tender",
  "Tidy",
  "Upbeat",
  "Vivid",
  "Warm",
  "Wise",
  "Zesty",
] as const;

export const USERNAME_NOUNS = [
  "Basket",
  "Beacon",
  "Bridge",
  "Button",
  "Candle",
  "Canvas",
  "Castle",
  "Circle",
  "Clover",
  "Compass",
  "Cookie",
  "Corner",
  "Cotton",
  "Cricket",
  "Crystal",
  "Doodle",
  "Fabric",
  "Falcon",
  "Feather",
  "Flower",
  "Forest",
  "Fountain",
  "Garden",
  "Garnet",
  "Glacier",
  "Guitar",
  "Hammer",
  "Harbor",
  "Helmet",
  "Horizon",
  "Island",
  "Jacket",
  "Kettle",
  "Ladder",
  "Lantern",
  "Letter",
  "Magnet",
  "Marble",
  "Meadow",
  "Mirror",
  "Mosaic",
  "Mountain",
  "Muffin",
  "Napkin",
  "Needle",
  "Notebook",
  "Orange",
  "Paddle",
  "Palette",
  "Pancake",
  "Parcel",
  "Pebble",
  "Pencil",
  "Penguin",
  "Petal",
  "Pillow",
  "Planet",
  "Pocket",
  "Puzzle",
  "Rabbit",
  "Rainbow",
  "Ribbon",
  "River",
  "Robot",
  "Rocket",
  "Ruler",
  "Sailor",
  "Scooter",
  "Shadow",
  "Shield",
  "Signal",
  "Snowball",
  "Sparkle",
  "Spiral",
  "Square",
  "Starfish",
  "Station",
  "Sticker",
  "Stream",
  "Summit",
  "Sunset",
  "Switch",
  "Ticket",
  "Toffee",
  "Topaz",
  "Tower",
  "Tractor",
  "Treasure",
  "Triangle",
  "Tricycle",
  "Tulip",
  "Tunnel",
  "Turret",
  "Turtle",
  "Valley",
  "Velvet",
  "Violet",
  "Wagon",
  "Walnut",
  "Widget",
  "Willow",
  "Window",
  "Winter",
  "Wizard",
  "Wonder",
] as const;

export type RandomIndexFn = (maxExclusive: number) => number;

function defaultRandomIndex(maxExclusive: number): number {
  return randomInt(maxExclusive);
}

export function slugifyUsername(displayUsername: string): string {
  return displayUsername.trim().toLowerCase().replace(/\s+/g, "-");
}

export function generateLearnerUsername(
  randomIndex: RandomIndexFn = defaultRandomIndex,
): { username: string; usernameSlug: string } {
  const adjective =
    USERNAME_ADJECTIVES[randomIndex(USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[randomIndex(USERNAME_NOUNS.length)];
  const username = `${adjective} ${noun}`;

  return {
    username,
    usernameSlug: slugifyUsername(username),
  };
}

export function isValidGeneratedUsername(username: string): boolean {
  const parts = username.split(" ");

  if (parts.length !== 2) {
    return false;
  }

  const [adjective, noun] = parts;

  return (
    (USERNAME_ADJECTIVES as readonly string[]).includes(adjective) &&
    (USERNAME_NOUNS as readonly string[]).includes(noun)
  );
}

export function isValidGeneratedUsernameSlug(usernameSlug: string): boolean {
  const parts = usernameSlug.split("-");

  if (parts.length !== 2) {
    return false;
  }

  const [adjective, noun] = parts;

  return (
    (USERNAME_ADJECTIVES as readonly string[]).includes(
      adjective.charAt(0).toUpperCase() + adjective.slice(1),
    ) &&
    (USERNAME_NOUNS as readonly string[]).includes(
      noun.charAt(0).toUpperCase() + noun.slice(1),
    )
  );
}
