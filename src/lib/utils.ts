import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formats a price value uniformly: single $ sign, always 2 decimal places
 * Examples: "29" -> "$29.00", "14.99" -> "$14.99", "0" -> "Free"
 */
export function formatPrice(price: string | number): string {
  // Remove any existing $ signs
  const cleanPrice = String(price).replace(/\$/g, '').trim();
  
  // Parse as number
  const numPrice = parseFloat(cleanPrice);
  
  // Free products
  if (isNaN(numPrice) || numPrice === 0 || cleanPrice.toLowerCase() === 'free') {
    return 'Free';
  }
  
  // Always show 2 decimal places
  return `$${numPrice.toFixed(2)}`;
}
