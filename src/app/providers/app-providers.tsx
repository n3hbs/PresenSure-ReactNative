import { ThemeProvider } from '@/app/providers/theme-provider';
import { QueryProvider } from '@/app/providers/query-provider';
import { AuthProvider } from '@/features/auth/auth-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
