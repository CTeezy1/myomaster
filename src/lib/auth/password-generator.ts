import "server-only";

import { randomInt } from "node:crypto";

export const FIVE_LETTER_PASSWORD_WORDS = [
  "apple",
  "beach",
  "birch",
  "brick",
  "candy",
  "cloud",
  "coral",
  "crisp",
  "dream",
  "flame",
  "fresh",
  "grape",
  "happy",
  "ivory",
  "jolly",
  "lemon",
  "light",
  "lucky",
  "maple",
  "merry",
  "noble",
  "olive",
  "peach",
  "pearl",
  "plant",
  "proud",
  "quiet",
  "river",
  "sharp",
  "slate",
  "smart",
  "spark",
  "stone",
  "storm",
  "sunny",
  "swift",
  "tidy",
  "valid",
  "vital",
  "whole",
  "young",
  "zesty",
] as const;

export type RandomIntFn = (maxExclusive: number) => number;

function defaultRandomIndex(maxExclusive: number): number {
  return randomInt(maxExclusive);
}

export function generateLearnerPassword(
  randomIndex: RandomIntFn = defaultRandomIndex,
): string {
  const word =
    FIVE_LETTER_PASSWORD_WORDS[
      randomIndex(FIVE_LETTER_PASSWORD_WORDS.length)
    ];
  const digit = randomIndex(10);

  return `${word}${digit}`;
}

export function isValidGeneratedLearnerPassword(password: string): boolean {
  if (!/^[a-z]{5}\d$/.test(password)) {
    return false;
  }

  const word = password.slice(0, 5);

  return (FIVE_LETTER_PASSWORD_WORDS as readonly string[]).includes(word);
}
