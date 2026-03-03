import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  // Convert to lowercase
  let baseSlug = text.toLowerCase();
  // Replace special chars with hyphen
  baseSlug = baseSlug.replace(/[\[\]<>~#^|%&*+$?!'"()@,;:\/\\\. ]/g, '-');
  // Remove multiple consecutive hyphens
  baseSlug = baseSlug.replace(/-+/g, '-');
  // Trim hyphens from start and end
  baseSlug = baseSlug.replace(/^-+|-+$/g, '');

  // Fallback if slug is empty (e.g., emojis or non-latin chars)
  if (!baseSlug) {
    baseSlug = Math.random().toString(36).substring(2, 10);
  }

  return baseSlug;
}
