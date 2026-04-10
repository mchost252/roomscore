import 'axios';

declare module 'axios' {
  export interface InternalAxiosRequestConfig {
    _isOfflineQueued?: boolean;
    _retry?: boolean;
    _retryCount?: number;
  }
}
