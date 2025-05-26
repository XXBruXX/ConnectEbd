
"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Se não estiver mais carregando os dados de autenticação
    // E não houver um usuário logado
    // E a rota atual não for a própria página de login (para evitar loop)
    if (!loading && !user && pathname !== '/login') {
      // Redireciona para a página de login,
      // passando a rota atual como parâmetro 'redirect'
      // para que o usuário possa ser redirecionado de volta após o login.
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  // Enquanto as informações de autenticação estão carregando, exibe um spinner.
  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  // Se não estiver carregando, mas não houver usuário E não estivermos na página de login,
  // o useEffect já cuidou do redirecionamento. Retornar um spinner aqui
  // evita que o conteúdo da página protegida "pisque" na tela antes do redirecionamento.
  if (!user && !loading && pathname !== '/login') {
    return <LoadingSpinner fullScreen />;
  }

  // Se houver um usuário (e não estiver carregando), renderize o conteúdo da página protegida.
  // Ou se estivermos na página de login, ela também pode ser renderizada.
  return <>{children}</>;
}
