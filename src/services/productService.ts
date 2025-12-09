import logger from '../lib/logger';
import { Product, ProductInput, ProductListResponse, ProductUpdateInput } from '@/types/product';

const API_BASE_URL = 'https://api.sellpoint.pp.ua';

class ProductService {
  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (!token) throw new Error('No authentication token available');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    logger.info('ProductService: Request', { url, method: options.method || 'GET' });
    const res = await fetch(url, options);
    logger.info('ProductService: Status', res.status);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 404) {
        logger.info('ProductService: 404 response (expected for some endpoints)', text);
      } else {
        logger.error('ProductService: Error body', text);
      }
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed?.message || res.statusText || 'Request failed');
      } catch {
        throw new Error(text || res.statusText || 'Request failed');
      }
    }
    const text = await res.text();
    try { logger.info('ProductService: Success body', text?.slice(0, 1000)); } catch {}
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async getAll(): Promise<Product[] | ProductListResponse> {
    return this.request<Product[] | ProductListResponse>('/api/Product/get-all', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({}),
    });
  }

  async getById(id: string): Promise<Product> {
    return this.request<Product>(`/api/Product/get-by-id/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
  }

  async getByName(name: string): Promise<Product[] | ProductListResponse> {
    return this.request<Product[] | ProductListResponse>(`/api/Product/get-by-name/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({}),
    });
  }

  async getBySellerId(sellerId: string, payload?: Record<string, unknown>): Promise<Product[] | ProductListResponse> {
    const body = payload ?? {};
    return this.request<Product[] | ProductListResponse>(`/api/Product/get-by-seller-id/${encodeURIComponent(sellerId)}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(body),
    });
  }

  async create(product: ProductInput): Promise<Product> {
    const response = await this.request<any>('/api/Product', {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(product),
    });

    // PERF OPTIMIZATION: Consolidated response shape normalization.
    // Previous implementation performed many console.log calls and repeated branching.
    // We now map known container keys to a candidate object and fall back to the first
    // nested object containing an 'id'. This reduces logging overhead and branching cost.
    logger.info('ProductService: Create response (normalized path)');

    if (response && typeof response === 'object') {
      const direct = (response as any).id ? response : null;
      const containerKeys = ['data', 'product', 'result', 'item'];
      const viaContainer = direct ? direct : containerKeys
        .map(k => (response as any)[k])
        .find(v => v && typeof v === 'object' && 'id' in v);
      if (viaContainer) return viaContainer as Product;

      // Fallback: scan shallow enumerable properties once.
      for (const value of Object.values(response)) {
        if (value && typeof value === 'object' && 'id' in (value as any)) {
          return value as Product;
        }
      }
    }
    return response as Product;
  }

  async update(product: ProductUpdateInput): Promise<Product> {
    const response = await this.request<any>('/api/Product', {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(product),
    });
    
    logger.info('ProductService: Update response', response);
    
    if (response && typeof response === 'object') {
      if (response.id) {
        return response as Product;
      } else if (response.data && response.data.id) {
        return response.data as Product;
      } else if (response.product && response.product.id) {
        return response.product as Product;
      }
    }
    
    return response as Product;
  }

  async addMedia(productId: string, files: File[]): Promise<any> {
    if (!files || files.length === 0) return { success: true };
    const token = this.getToken();
    if (!token) throw new Error('No authentication token available');

    const form = new FormData();
    
    files.forEach((f, idx) => {
      form.append('files', f, f.name || `file_${idx}`);
      
      const isVideo = f.type.startsWith('video/') || 
        /\.(mp4|webm|mov|avi|mkv|m4v|ogg)$/i.test(f.name);
      
      if (isVideo) {
        form.append('type', '1'); 
      } else {
        form.append('type', '0'); 
      }
    });
    
    const url = `${API_BASE_URL}/api/ProductMedia/many?productId=${encodeURIComponent(productId)}`;
    
    try {
      console.log('ProductService: Starting media upload...');
      console.log('ProductService: URL:', url);
      console.log('ProductService: ProductId:', productId);
      console.log('ProductService: Files:', files.map(f => ({ 
        name: f.name, 
        size: f.size, 
        type: f.type,
        isVideo: f.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v|ogg)$/i.test(f.name)
      })));
      
      logger.info('ProductService: Uploading media via PUT /api/ProductMedia/many', { 
        productId, 
        fileCount: files.length,
        fileNames: files.map(f => f.name)
      });
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      
      const responseText = await res.text();
      console.log('ProductService: Media upload response status:', res.status);
      console.log('ProductService: Media upload response body:', responseText);
      
      logger.info('ProductService: Media upload response', { 
        status: res.status, 
        body: responseText?.slice(0, 500) 
      });
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} - ${responseText}`);
      }
      
      console.log('ProductService: Media upload successful');
      return { success: true };
    } catch (e) {
      console.error('ProductService: Media upload error:', e);
      logger.error('ProductService: Media upload failed', e as any);
      throw e;
    }
  }

  async delete(id: string): Promise<any> {
    const params = new URLSearchParams({ id });
    return this.request<any>(`/api/Product?${params.toString()}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
  }

  async search(name: string): Promise<any> {
    const params = new URLSearchParams({ name });
    return this.request<any>(`/api/Product/search?${params.toString()}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
  }

  async random(): Promise<any> {
    return this.request<any>('/api/Product/random', {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
  }
}

export const productService = new ProductService();


