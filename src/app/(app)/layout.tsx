
import { AuthWrapper } from '@/components/auth/AuthWrapper';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNavigationBar } from '@/components/layout/BottomNavigationBar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthWrapper>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="flex-grow bg-background p-4 md:p-6 pb-[calc(4rem+1rem)] fade-in-page"> 
          {/* pb accounts for bottom nav height (4rem) + some padding (1rem) */}
          {children}
        </main>
        <BottomNavigationBar />
      </div>
    </AuthWrapper>
  );
}
