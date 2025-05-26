
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Image from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Mail, Lock } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, loading, signInWithEmail, signUpWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user) {
      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectUrl);
    }
  }, [user, loading, router, searchParams]);

  const handleSignIn = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await signInWithEmail(data.email, data.password);
      toast({ title: "Login bem-sucedido!", description: "Redirecionando..." });
    } catch (error: any) {
      let description = "Não foi possível fazer login. Verifique suas credenciais e tente novamente.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = "Email ou senha incorretos.";
      } else if (error.code === 'auth/too-many-requests') {
        description = "Muitas tentativas de login. Tente novamente mais tarde.";
      }
      toast({
        title: "Falha no Login",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    router.push('/register/user-info');
  };


  if (loading || (!loading && user )) { 
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="text-center px-6 pt-6 pb-3 space-y-1">
          <Image
            src="/logo.png" 
            alt="Controle EBD Logo"
            width={150} 
            height={150} 
            className="mx-auto"
          />
          <CardTitle className="text-3xl font-bold text-primary">Controle EBD</CardTitle>
          <CardDescription className="text-muted-foreground">
            Bem-vindo! Faça login para gerenciar sua Escola Bíblica Dominical.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSignIn)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                    <FormControl>
                      <Input placeholder="seuemail@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Lock className="mr-2 h-4 w-4 text-muted-foreground" />Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-md"
                disabled={isSubmitting || loading}
              >
                {isSubmitting && <LoadingSpinner size={20} className="mr-2" />}
                Entrar
              </Button>
            </form>
          </Form>

          
          <Button
            variant="outline"
            className="w-full py-3 text-md"
            disabled={isSubmitting || loading}
            onClick={handleCreateAccount}
          >
            Criar Conta
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
