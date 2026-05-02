/**
 * ApiUtils.ts - Centralized API path resolution
 * Handles environment-specific API endpoints and provides guidance for static hosting.
 */
export class ApiUtils {
    /**
     * Resolves a relative API path to a full URL or absolute path.
     * @param path The relative path (e.g., '/api/user/sync')
     * @returns The resolved URL
     */
    /**
     * Production API Base URL for global features (like Rankings)
     */
    private static readonly PRODUCTION_URL = 'https://nexussphere.pages.dev';

    /**
     * Resolves a relative API path to a full URL or absolute path.
     * @param path The relative path (e.g., '/api/user/sync')
     * @param forceGlobal If true, always points to the production server regardless of local environment.
     * @returns The resolved URL
     */
    public static resolve(path: string, forceGlobal: boolean = false): string {
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        // 1. Force Global (Production) if requested
        if (forceGlobal) {
            return `${this.PRODUCTION_URL}${normalizedPath}`;
        }

        // 2. Check for remote API override from environment
        const remoteApiUrl = import.meta.env.VITE_API_URL;
        if (remoteApiUrl) {
            const base = remoteApiUrl.endsWith('/') ? remoteApiUrl.slice(0, -1) : remoteApiUrl;
            return `${base}${normalizedPath}`;
        }

        // 3. Default to relative path with BASE_URL support
        const baseUrl = import.meta.env.BASE_URL || '/';
        const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        
        const finalPath = `${normalizedBase}${normalizedPath}`.replace(/\/+/g, '/');
        
        // 4. Domain-specific guidance for GitHub Pages
        if (window.location.hostname.includes('github.io') && import.meta.env.PROD) {
            console.warn(
                `[ApiUtils] detected static hosting (GitHub Pages). ` +
                `API call to ${finalPath} will likely fail (404) because GitHub Pages is static. ` +
                `Please move to Cloudflare Pages or set VITE_API_URL in your environment.`
            );
        }

        return finalPath;
    }

    /**
     * Enhanced fetch wrapper with support for global production API routing.
     */
    public static async fetch(path: string, options: RequestInit = {}): Promise<Response> {
        // ALWAYS use production URL to ensure local and web environments use the same D1 DB
        const baseUrl = this.PRODUCTION_URL; 
        const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
        const response = await fetch(url, options);

        if (response.status === 404 && window.location.hostname.includes('github.io')) {
             console.error(
                `[ApiUtils] API 404 detected on GitHub Pages. ` +
                `Did you forget to host your backend on Cloudflare Pages? ` +
                `Current resolved URL: ${url}`
             );
        }

        return response;
    }
}
