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
    public static resolve(path: string): string {
        // 1. Check for remote API override (e.g. https://nexussphere.pages.dev)
        const remoteApiUrl = import.meta.env.VITE_API_URL;
        if (remoteApiUrl) {
            const base = remoteApiUrl.endsWith('/') ? remoteApiUrl.slice(0, -1) : remoteApiUrl;
            const normalizedPath = path.startsWith('/') ? path : `/${path}`;
            return `${base}${normalizedPath}`;
        }

        // 2. Default to relative path with BASE_URL support
        const baseUrl = import.meta.env.BASE_URL || '/';
        const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        
        const finalPath = `${normalizedBase}${normalizedPath}`.replace(/\/+/g, '/');
        
        // 3. Domain-specific guidance for GitHub Pages
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
     * Enhanced fetch wrapper with better error reporting for hosting issues.
     */
    public static async fetch(path: string, options: RequestInit = {}): Promise<Response> {
        const url = this.resolve(path);
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
