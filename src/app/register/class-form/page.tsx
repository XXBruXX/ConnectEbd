
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, doc, getDoc, updateDoc, DocumentData } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { School, Users, AlertTriangle, Building, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const classSchema = z.object({
  establishmentId: z.string().min(1, { message: "Selecione a igreja ou congregação." }),
  className: z.string().min(1, { message: "O nome da classe é obrigatório." }),
  ageGroup: z.string().min(1, { message: "Selecione a faixa etária." }),
});

type ClassFormValues = z.infer<typeof classSchema>;

interface EstablishmentOption {
  id: string;
  name: string;
  type: 'sede' | 'congregacao';
}

const ageGroupOptions = [
  { value: "Maternal – 1 a 2 anos", label: "Maternal – 1 a 2 anos" },
  { value: "Jardim de Infância – 3 a 4 anos", label: "Jardim de Infância – 3 a 4 anos" },
  { value: "Primários – 5 a 6 anos", label: "Primários – 5 a 6 anos" },
  { value: "Juniores – 7 a 8 anos", label: "Juniores – 7 a 8 anos" },
  { value: "Pré-Adolescentes – 9 a 10 anos", label: "Pré-Adolescentes – 9 a 10 anos" },
  { value: "Adolescentes – 11 a 14 anos", label: "Adolescentes – 11 a 14 anos" },
  { value: "Juvenis – 15 a 17 anos", label: "Juvenis – 15 a 17 anos" },
  { value: "Jovens – 18 a 25 anos", label: "Jovens – 18 a 25 anos" },
  { value: "Adultos – a partir de 26 anos", label: "Adultos – a partir de 26 anos" },
];

export default function ClassFormPage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const classIdToEdit = searchParams.get('id');
  const isEditMode = !!classIdToEdit;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Combined loading state
  const [headquartersChurchName, setHeadquartersChurchName] = useState<string | null>(null);

  const form = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      establishmentId: "",
      className: "",
      ageGroup: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Acesso Negado", description: "Por favor, faça login para continuar.", variant: "destructive"});
      router.replace('/login');
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    const fetchData = async () => {
      if (user && db) {
        setLoadingData(true);
        let fetchedEstablishments: EstablishmentOption[] = [];
        let hqName: string | null = null;

        try {
          // Fetch headquarters church
          const hqQuery = query(collection(db, "churches"), where("adminUid", "==", user.uid), limit(1));
          const hqSnapshot = await getDocs(hqQuery);

          if (!hqSnapshot.empty) {
            const hqDoc = hqSnapshot.docs[0];
            hqName = hqDoc.data().nomeIgreja as string;
            setHeadquartersChurchName(hqName);
            fetchedEstablishments.push({
              id: hqDoc.id,
              name: `${hqName} (Sede)`,
              type: 'sede',
            });

            // Fetch congregations linked to this headquarters
            const congregationsQuery = query(collection(db, "congregations"), where("adminUid", "==", user.uid), where("headquartersChurchId", "==", hqDoc.id));
            const congregationsSnapshot = await getDocs(congregationsQuery);
            congregationsSnapshot.forEach(doc => {
              fetchedEstablishments.push({
                id: doc.id,
                name: doc.data().nomeCongregacao as string,
                type: 'congregacao',
              });
            });
          } else {
            setHeadquartersChurchName(null);
          }
          setEstablishments(fetchedEstablishments);

          // If in edit mode, fetch class data
          if (isEditMode && classIdToEdit) {
            const classDocRef = doc(db, "classes", classIdToEdit);
            const classDocSnap = await getDoc(classDocRef);
            if (classDocSnap.exists()) {
              const classData = classDocSnap.data() as ClassFormValues;
              // Ensure adminUid matches for security
              if (classDocSnap.data().adminUid === user.uid) {
                form.reset(classData);
              } else {
                toast({ title: "Acesso Negado", description: "Você não tem permissão para editar esta classe.", variant: "destructive" });
                router.push('/classes'); // Redirect if not authorized
              }
            } else {
              toast({ title: "Classe não encontrada", description: "Não foi possível encontrar os dados da classe para edição.", variant: "destructive" });
              router.push('/classes');
            }
          }
        } catch (error) {
          console.error("Error fetching data: ", error);
          toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar os dados necessários.", variant: "destructive" });
        } finally {
          setLoadingData(false);
        }
      } else if (!authLoading && !user) {
        setLoadingData(false);
      }
    };

    if (!authLoading && user) {
      fetchData();
    }
  }, [user, db, authLoading, toast, isEditMode, classIdToEdit, form, router]);

  const onSubmit = async (data: ClassFormValues) => {
    if (!user || !db) {
      toast({ title: "Erro", description: "Informações essenciais ausentes.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const selectedEstablishment = establishments.find(e => e.id === data.establishmentId);
    if (!selectedEstablishment) {
        toast({ title: "Erro", description: "Estabelecimento selecionado não encontrado.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
      if (isEditMode && classIdToEdit) {
        const classDocRef = doc(db, "classes", classIdToEdit);
        await updateDoc(classDocRef, {
          ...data, // adminUid is not updated, establishmentId, name, ageGroup might be
          establishmentName: selectedEstablishment.name.replace(' (Sede)',''),
          establishmentType: selectedEstablishment.type,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Classe Atualizada!", description: "As informações da classe foram atualizadas." });
      } else {
        await addDoc(collection(db, "classes"), {
          adminUid: user.uid,
          establishmentId: data.establishmentId,
          establishmentName: selectedEstablishment.name.replace(' (Sede)',''),
          establishmentType: selectedEstablishment.type,
          className: data.className,
          ageGroup: data.ageGroup,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Classe Cadastrada!", description: "A nova classe foi registrada com sucesso." });
      }
      form.reset(); // Reset form after successful submission
      router.push('/classes'); // Redirect to classes list page
    } catch (error: any) {
      toast({
        title: isEditMode ? "Falha ao Atualizar Classe" : "Falha ao Cadastrar Classe",
        description: "Não foi possível salvar as informações. Tente novamente." + (error.message ? ` (${error.message})` : ''),
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

  if (!headquartersChurchName && !loadingData) {
    return (
      <Card className="w-full max-w-lg border-destructive shadow-none">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl font-bold text-destructive">Igreja Sede Necessária</CardTitle>
          <CardDescription className="text-muted-foreground">
            Você precisa ter uma igreja sede cadastrada para poder criar classes.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="shadow-none">
            <Link href="/register/church-info">Cadastrar Igreja Sede</Link>
          </Button>
           <Button variant="outline" className="ml-2 shadow-none" onClick={() => router.push(isEditMode ? '/classes' : '/registration')}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (establishments.length === 0 && !loadingData) {
     return (
      <Card className="w-full max-w-lg border-border shadow-none">
        <CardHeader className="text-center">
          <Building className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="text-xl font-bold text-primary">Nenhum Local para Classes</CardTitle>
          <CardDescription className="text-muted-foreground">
            Além da Sede, você pode cadastrar Congregações para vincular classes.
            No momento, apenas a Sede está disponível, ou nenhuma foi encontrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
           <p className="mb-4">Cadastre classes para a Sede ou adicione Congregações primeiro.</p>
          <Button asChild className="shadow-none mr-2">
            <Link href="/register/congregation-form">Gerenciar Congregações</Link>
          </Button>
          <Button variant="outline" className="shadow-none" onClick={() => router.push(isEditMode ? '/classes' : '/registration')}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-none">
      <CardHeader className="text-center">
        <School className="mx-auto h-10 w-10 text-primary" />
        <CardTitle className="text-2xl font-bold text-primary">
          {isEditMode ? "Editar Classe" : "Cadastro de Classe"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isEditMode ? "Altere os dados da classe selecionada." : "Preencha os dados para criar uma nova classe para sua EBD."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="establishmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Building className="mr-2 h-4 w-4 text-muted-foreground" />Vincular à</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a Sede ou Congregação" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {establishments.map((est) => (
                        <SelectItem key={est.id} value={est.id}>
                          {est.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="className"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><School className="mr-2 h-4 w-4 text-muted-foreground" />Nome da Classe</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Classe de Casais, Primários" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ageGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Faixa Etária</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a faixa etária" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ageGroupOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-md shadow-none"
              disabled={isSubmitting || authLoading || loadingData}
            >
              {(isSubmitting || loadingData) && <LoadingSpinner size={20} className="mr-2" />}
              {isEditMode ? "Salvar Alterações" : "Salvar Classe"}
            </Button>
          </form>
        </Form>
        <Button
            type="button"
            variant="outline"
            className="w-full mt-4 shadow-none flex items-center"
            onClick={() => router.push(isEditMode ? '/classes' : '/registration')}
            disabled={isSubmitting}
        >
            <ArrowLeft className="mr-2 h-4 w-4"/> Voltar
        </Button>
      </CardContent>
    </Card>
  );
}
