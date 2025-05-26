
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Mail, Lock, Phone, Hash } from 'lucide-react'; 
import Image from 'next/image';

const userInfoSchema = z.object({
  nome: z.string().min(1, { message: "O nome é obrigatório." }),
  idade: z.coerce.number().min(1, { message: "A idade é obrigatória." }).positive({ message: "Idade deve ser um número positivo."}),
  telefone: z.string().min(10, { message: "O telefone deve ter pelo menos 10 dígitos." }),
  email: z.string().email({ message: "Por favor, insira um email válido." }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres." }),
});

type UserInfoFormValues = z.infer<typeof userInfoSchema>;

export default function UserInfoPage() {
  const { signUpWithEmail, user: authUser, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UserInfoFormValues>({
    resolver: zodResolver(userInfoSchema),
    defaultValues: {
      nome: "",
      idade: undefined, 
      telefone: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: UserInfoFormValues) => {
    setIsSubmitting(true);
    try {
      const userCredential = await signUpWithEmail(data.email, data.password);
      
      if (userCredential?.user && db) {
        const userId = userCredential.user.uid;
        await setDoc(doc(db, "users", userId), {
          nome: data.nome,
          idade: data.idade,
          telefone: data.telefone,
          email: data.email, 
          createdAt: new Date(),
        });
        toast({ title: "Conta criada!", description: "Informações pessoais salvas. Próximo passo: dados da igreja." });
        router.push('/register/church-info');
      } else if (!userCredential?.user) {
         throw new Error("Usuário não foi criado corretamente no Firebase Auth.");
      } else if (!db) {
        throw new Error("Conexão com Firestore não disponível.");
      }
    } catch (error: any) {
      let description = "Não foi possível criar a conta. Tente novamente.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este email já está em uso por outra conta.";
      } else if (error.code === 'auth/weak-password') {
        description = "A senha é muito fraca. Use pelo menos 6 caracteres.";
      }
      toast({
        title: "Falha ao Criar Conta",
        description: description + (error.message ? ` (${error.message})` : ''),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Card className="w-full max-w-lg border-border shadow-none">
      <CardHeader className="text-center">
        <Image 
          src="https://placehold.co/80x80.png" 
          data-ai-hint="church user icon"
          alt="Cadastro Controle EBD" 
          width={80} 
          height={80} 
          className="mx-auto mb-4 rounded-lg"
        />
        <CardTitle className="text-2xl font-bold text-primary">Cadastro - Suas Informações</CardTitle>
        <CardDescription className="text-muted-foreground">
          Primeiro, precisamos de algumas informações sobre você.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="idade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Hash className="mr-2 h-4 w-4 text-muted-foreground" />Idade</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Sua idade" {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(XX) XXXXX-XXXX" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seuemail@example.com" {...field} />
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
                    <Input type="password" placeholder="Crie uma senha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-md shadow-none"
              disabled={isSubmitting || authLoading}
            >
              {isSubmitting && <LoadingSpinner size={20} className="mr-2" />}
              Próximo Passo
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
