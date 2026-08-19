import { authMode } from '@/shared/runtime-config';

export const isLocalMode = () => authMode() === 'local';
