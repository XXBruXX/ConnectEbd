
"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from '@/hooks/use-auth';
import { LogOut, UserCircle, Settings, Home, Building, Network, Pencil, ListChecks, Users as UsersIcon, Church as ChurchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import React from 'react';
import { cn } from '@/lib/utils';
import { ThemeSwitcher } from '@/components/shared/ThemeSwitcher'; // Import ThemeSwitcher

export function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsSheetOpen(false);
      toast({ title: "Logout bem-sucedido!"});
      router.push('/login');
    } catch (error) {
      toast({ title: "Erro ao sair", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsSheetOpen(false);
  };

  const getInitials = (name?: string | null) => {
    if (!name && user?.email) return user.email[0].toUpperCase();
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1 && names[0].length > 0) return names[0][0].toUpperCase();
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return names[0] ? names[0].substring(0, 2).toUpperCase() : 'U';
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card text-card-foreground"> {/* Changed to bg-card to match dashboard */}
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-bold">
          <Avatar className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center font-semibold">
            <AvatarFallback>E</AvatarFallback> {/* "E" for EBD */}
          </Avatar>
          <span className="text-foreground">Controle EBD</span>
        </Link>
        
        <div className="flex items-center gap-2">
          <ThemeSwitcher /> {/* Add ThemeSwitcher here */}
          {user && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-9 w-9 bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User avatar'} />
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </SheetTrigger>
              <SheetContent 
                className={cn(
                  "w-[300px] sm:w-[350px] p-0 flex flex-col h-full border-l-0",
                  "bg-sidebar-background text-sidebar-foreground" 
                )}
                side="right"
              >
                <SheetHeader className="p-4 text-left border-b border-sidebar-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-sidebar-primary/50 bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User avatar'} />
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <SheetTitle className="text-md font-semibold text-sidebar-foreground">{user.displayName || 'Usuário'}</SheetTitle>
                      <span className="text-xs text-sidebar-foreground/80 block truncate max-w-[180px]">
                        {user.email}
                      </span>
                    </div>
                  </div>
                </SheetHeader>
                
                <ScrollArea className="flex-grow">
                  <div className="p-4 space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium text-sm" onClick={() => handleNavigation('/profile')}>
                      <UserCircle className="h-5 w-5" /> Perfil
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium text-sm" onClick={() => handleNavigation('/settings')}>
                      <Settings className="h-5 w-5" /> Configurações
                    </Button>

                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="sede" className="border-b-0">
                        <AccordionTrigger 
                          className={cn(
                            "flex w-full items-center justify-between text-sm font-medium hover:no-underline py-3 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sidebar-foreground",
                            "[&[data-state=open]>svg]:rotate-180 [&_svg]:text-sidebar-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2"><Home className="h-5 w-5" />Igreja Sede</div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-6 pr-2 space-y-0.5 pt-1">
                          <Button variant="ghost" className="w-full justify-start gap-2 text-sm h-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => handleNavigation('/register/church-info')}>
                            <Pencil className="h-4 w-4" /> Editar Dados
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 text-sm h-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => handleNavigation('/classes')}>
                            <ListChecks className="h-4 w-4" /> Classes Vinculadas
                          </Button>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="congregacoes" className="border-b-0">
                        <AccordionTrigger 
                          className={cn(
                            "flex w-full items-center justify-between text-sm font-medium hover:no-underline py-3 px-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md text-sidebar-foreground",
                            "[&[data-state=open]>svg]:rotate-180 [&_svg]:text-sidebar-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2"><Building className="h-5 w-5" />Congregações</div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-6 pr-2 space-y-0.5 pt-1">
                          <Button variant="ghost" className="w-full justify-start gap-2 text-sm h-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => handleNavigation('/register/congregation-form')}>
                            <Network className="h-4 w-4" /> Gerenciar
                          </Button>
                          <Button variant="ghost" className="w-full justify-start gap-2 text-sm h-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => handleNavigation('/classes')}>
                            <ListChecks className="h-4 w-4" /> Classes Vinculadas
                          </Button>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </ScrollArea>
                
                <div className="p-4 border-t border-sidebar-border mt-auto"> 
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium text-sm" onClick={handleSignOut}>
                    <LogOut className="h-5 w-5" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

    