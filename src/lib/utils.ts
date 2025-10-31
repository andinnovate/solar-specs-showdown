import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Adds Amazon affiliate tag to Amazon.com URLs
 * @param url - The original URL
 * @returns The URL with affiliate tag added if it's an Amazon.com URL
 */
export function addAmazonAffiliateTag(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Only process Amazon.com URLs
    if (urlObj.hostname.includes('amazon.com')) {
      // Add or update the tag parameter
      urlObj.searchParams.set('tag', 'tene04-20');
      return urlObj.toString();
    }
    
    // Return original URL if not Amazon
    return url;
  } catch (error) {
    // If URL parsing fails, return original URL
    console.error('Error processing URL:', error);
    return url;
  }
}
