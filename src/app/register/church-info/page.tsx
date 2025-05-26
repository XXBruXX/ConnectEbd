
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building, MapPin, Home, Landmark } from 'lucide-react';
import Image from 'next/image';

const churchInfoSchema = z.object({
  nomeIgreja: z.string().min(1, { message: "O nome da igreja é obrigatório." }),
  endereco: z.string().min(1, { message: "O endereço é obrigatório." }),
  cidade: z.string().min(1, { message: "A cidade é obrigatória." }),
  estado: z.string().min(2, { message: "O estado é obrigatório (ex: SP)." }).max(50, { message: "Estado muito longo."}),
});

type ChurchInfoFormValues = z.infer<typeof churchInfoSchema>;

export default function ChurchInfoPage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingChurchId, setEditingChurchId] = useState<string | null>(null);
  const [initialDataLoading, setInitialDataLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState("Cadastro - Sua Igreja");
  const [pageDescription, setPageDescription] = useState("Conte-nos sobre a igreja sede que você representa.");
  const [submitButtonText, setSubmitButtonText] = useState("Concluir Cadastro e Acessar");


  const form = useForm<ChurchInfoFormValues>({
    resolver: zodResolver(churchInfoSchema),
    defaultValues: {
      nomeIgreja: "",
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
    const fetchChurchData = async () => {
      if (user && db) {
        setInitialDataLoading(true);
        try {
          const q = query(collection(db, "churches"), where("adminUid", "==", user.uid), limit(1));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const churchDoc = querySnapshot.docs[0];
            const churchData = churchDoc.data() as ChurchInfoFormValues;
            form.reset(churchData);
            setEditingChurchId(churchDoc.id);
            setPageTitle("Editar Informações da Igreja Sede");
            setPageDescription("Atualize os dados da sua igreja sede.");
            setSubmitButtonText("Salvar Alterações");
          } else {
            setPageTitle("Cadastro - Sua Igreja");
            setPageDescription("Conte-nos sobre a igreja sede que você representa.");
            setSubmitButtonText("Concluir Cadastro e Acessar");
          }
        } catch (error) {
          console.error("Error fetching church data: ", error);
          toast({ title: "Erro ao carregar dados", description: "Não foi possível carregar os dados da igreja.", variant: "destructive" });
        } finally {
          setInitialDataLoading(false);
        }
      } else if (!authLoading && !user) {
        setInitialDataLoading(false); 
      }
    };

    if (!authLoading) { 
        fetchChurchData();
    }
  }, [user, db, authLoading, form, toast]);


  const onSubmit = async (data: ChurchInfoFormValues) => {
    if (!user || !db) {
      toast({ title: "Erro", description: "Usuário não autenticado ou conexão com banco de dados indisponível.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingChurchId) {
        const churchDocRef = doc(db, "churches", editingChurchId);
        await updateDoc(churchDocRef, {
            ...data,
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Dados Atualizados!", description: "As informações da igreja foram atualizadas." });
      } else {
        await addDoc(collection(db, "churches"), {
          adminUid: user.uid,
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Igreja Cadastrada!", description: "Sua igreja foi registrada com sucesso." });
      }
      router.push('/dashboard'); 
    } catch (error: any) {
      toast({
        title: editingChurchId ? "Falha ao Atualizar" : "Falha ao Cadastrar Igreja",
        description: "Não foi possível salvar as informações. Tente novamente." + (error.message ? ` (${error.message})` : ''),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || initialDataLoading || (!authLoading && !user)) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <Card className="w-full max-w-lg border-border shadow-none">
      <CardHeader className="text-center">
         <Image 
            src="https://placehold.co/80x80.png" 
            data-ai-hint="church building icon"
            alt="Cadastro Igreja Controle EBD" 
            width={80} 
            height={80} 
            className="mx-auto mb-4 rounded-lg"
          />
        <CardTitle className="text-2xl font-bold text-primary">{pageTitle}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {pageDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nomeIgreja"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Nome da Igreja Sede</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome oficial da igreja" {...field} />
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
                      <Input placeholder="Sua cidade" {...field} />
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
              disabled={isSubmitting || authLoading || initialDataLoading}
            >
              {(isSubmitting || initialDataLoading) && <LoadingSpinner size={20} className="mr-2" />}
              {submitButtonText}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
