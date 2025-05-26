
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building, MapPin, Home, Landmark, ArrowLeft, Edit3 } from 'lucide-react';

const congregationEditSchema = z.object({
  nomeCongregacao: z.string().min(1, { message: "O nome da congregação é obrigatório." }),
  endereco: z.string().min(1, { message: "O endereço é obrigatório." }),
  cidade: z.string().min(1, { message: "A cidade é obrigatória." }),
  estado: z.string().min(2, { message: "O estado é obrigatório (ex: SP)." }).max(50, { message: "Estado muito longo."}),
});

type CongregationEditFormValues = z.infer<typeof congregationEditSchema>;

export default function EditCongregationFormPage() {
  const params = useParams();
  const router = useRouter();
  const congregationId = params.congregationId as string;

  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [initialCongregationName, setInitialCongregationName] = useState("");


  const form = useForm<CongregationEditFormValues>({
    resolver: zodResolver(congregationEditSchema),
    defaultValues: {
      nomeCongregacao: "",
      endereco: "",
      cidade: "",
      estado: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Acesso Negado", description: "Por favor, faça login para continuar.", variant: "destructive"});
      router.replace('/login');
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    const fetchCongregationData = async () => {
      if (user && db && congregationId) {
        setLoadingData(true);
        try {
          const congDocRef = doc(db, "congregations", congregationId);
          const congDocSnap = await getDoc(congDocRef);

          if (congDocSnap.exists()) {
            const data = congDocSnap.data();
            if (data.adminUid === user.uid) {
              form.reset({
                nomeCongregacao: data.nomeCongregacao,
                endereco: data.endereco,
                cidade: data.cidade,
                estado: data.estado,
              });
              setInitialCongregationName(data.nomeCongregacao);
            } else {
              toast({ title: "Acesso Negado", description: "Você não tem permissão para editar esta congregação.", variant: "destructive" });
              router.push('/register/congregation-form');
            }
          } else {
            toast({ title: "Congregação não encontrada", variant: "destructive" });
            router.push('/register/congregation-form');
          }
        } catch (error) {
          console.error("Error fetching congregation data: ", error);
          toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar os dados da congregação.", variant: "destructive" });
        } finally {
          setLoadingData(false);
        }
      } else if (!authLoading && !user) {
         setLoadingData(false); // User not logged in, stop loading
      }
    };
    if (!authLoading && user) {
        fetchCongregationData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, congregationId, authLoading, router, toast]); // form removed from deps

  const onSubmit = async (data: CongregationEditFormValues) => {
    if (!user || !db || !congregationId) {
      toast({ title: "Erro", description: "Informações essenciais ausentes.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const congDocRef = doc(db, "congregations", congregationId);
      await updateDoc(congDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Congregação Atualizada!", description: `"${data.nomeCongregacao}" foi atualizada com sucesso.` });
      router.push('/register/congregation-form');
    } catch (error: any) {
      toast({
        title: "Falha ao Atualizar",
        description: "Não foi possível salvar as alterações. Tente novamente." + (error.message ? ` (${error.message})` : ''),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || loadingData) {
    return <LoadingSpinner fullScreen />;
  }
   if (!user) {
     return <div className="flex min-h-screen items-center justify-center"><p>Redirecionando para login...</p></div>;
  }


  return (
    <Card className="w-full max-w-lg shadow-none">
      <CardHeader className="text-center">
        <Edit3 className="mx-auto h-10 w-10 text-primary" />
        <CardTitle className="text-2xl font-bold text-primary">
          Editar Congregação
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Altere os dados da congregação "{initialCongregationName || 'Carregando...'}".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nomeCongregacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Nome da Congregação</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome oficial da congregação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground" />Endereço Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, Número, Bairro, CEP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Home className="mr-2 h-4 w-4 text-muted-foreground" />Cidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Cidade da congregação" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Landmark className="mr-2 h-4 w-4 text-muted-foreground" />Estado</FormLabel>
                    <FormControl>
                      <Input placeholder="UF (ex: SP)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-md shadow-none"
              disabled={isSubmitting || authLoading || loadingData}
            >
              {(isSubmitting || loadingData) && <LoadingSpinner size={20} className="mr-2" />}
              Salvar Alterações
            </Button>
          </form>
        </Form>
         <Button
            type="button"
            variant="outline"
            className="w-full mt-4 shadow-none flex items-center"
            onClick={() => router.push('/register/congregation-form')}
            disabled={isSubmitting}
        >
            <ArrowLeft className="mr-2 h-4 w-4"/> Voltar para Gerenciar Congregações
        </Button>
      </CardContent>
    </Card>
  );
}

    