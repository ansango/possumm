import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FolderOpen,
  Home,
  Loader2,
  LoaderCircle,
  Music,
  RotateCw,
  Settings,
  Terminal,
  XCircle
} from 'lucide-svelte';
import type { ComponentType } from 'svelte';

/**
 * Centralized icon dictionary for consistent icon usage across the application
 */
export const Icon = {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FolderOpen,
  Home,
  Loader2,
  LoaderCircle,
  Music,
  RotateCw,
  Settings,
  Terminal,
  XCircle
} as const satisfies Record<string, ComponentType>;

export type IconName = keyof typeof Icon;
