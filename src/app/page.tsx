
"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Usamos useEffect para garantir que o router só seja chamado no lado do cliente
  // e após a hidratação inicial.
  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Continua exibindo o spinner enquanto o carregamento está em andamento
  // ou enquanto o redirecionamento do useEffect não ocorreu.
  return <LoadingSpinner fullScreen />;
}
