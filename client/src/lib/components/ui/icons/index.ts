import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FolderOpen,
  Home,
  Loader2,
  LoaderCircle,
  Music,
  RotateCw,
  Settings,
  XCircle
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

/**
 * Centralized icon dictionary for consistent icon usage across the application
 */
export const Icon = {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FolderOpen,
  Home,
  Loader2,
  LoaderCircle,
  Music,
  RotateCw,
  Settings,
  XCircle
} as const satisfies Record<string, ComponentType>;

export type IconName = keyof typeof Icon;
