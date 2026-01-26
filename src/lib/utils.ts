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
 * Formats a price value uniformly: no trailing .00, single $ sign
 * Examples: "29.99" -> "$29.99", "$29.00" -> "$29", "0" -> "Free"
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
  
  // Format: remove .00 but keep other decimals like .99
  const formatted = numPrice % 1 === 0 
    ? numPrice.toFixed(0) 
    : numPrice.toFixed(2);
  
  return `$${formatted}`;
}
