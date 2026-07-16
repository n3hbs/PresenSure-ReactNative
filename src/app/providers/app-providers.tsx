import { ThemeProvider } from '@/app/providers/theme-provider';
import { AuthProvider } from '@/features/auth/auth-context';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
