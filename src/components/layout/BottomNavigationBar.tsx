
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CalendarDays, Users, School, ClipboardList, Home } from 'lucide-react'; // Home for Geral

const navItems = [
  { href: '/schedule', label: 'Aula', icon: CalendarDays },
  { href: '/students', label: 'Alunos', icon: Users },
  { href: '/classes', label: 'Classes', icon: School },
  { href: '/registration', label: 'Cadastro', icon: ClipboardList },
  { href: '/dashboard', label: 'Geral', icon: Home },
];

export function BottomNavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card text-card-foreground shadow-[0_-2px_10px_-3px_hsl(var(--background)/0.05)] dark:shadow-[0_-2px_10px_-3px_hsl(var(--foreground)/0.05)]">
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/registration' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative inline-flex flex-col items-center justify-center px-2 text-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background rounded-md',
                'transition-all duration-200 ease-in-out'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className={cn(
                  "relative flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 ease-in-out w-full h-full",
                  isActive ? "bg-accent/20 border-t-2 border-primary" : "" // Added border for active state
              )}>
                {/* Removed the span for neon glow effect */}
                <item.icon className={cn(
                    'mb-0.5 h-5 w-5 transition-all duration-200 ease-in-out z-10', 
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground group-hover:text-foreground'
                )} />
                <span className={cn(
                    'transition-all duration-200 ease-in-out text-xs z-10', 
                    isActive ? 'font-semibold text-primary' : 'text-muted-foreground group-hover:text-foreground' 
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
