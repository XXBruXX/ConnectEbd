
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, addDoc, serverTimestamp, query, where, getDocs, DocumentData, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserPlus, School, Users, CalendarIcon as CalendarIconLucide, Phone, Home, HeartHandshake, Briefcase, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

const personSchema = z.object({
  nomeCompleto: z.string().min(1, { message: "O nome completo é obrigatório." }),
  idade: z.coerce.number().min(1, { message: "A idade é obrigatória." }).positive({ message: "Idade deve ser um número positivo." }),
  classId: z.string().min(1, { message: "Selecione a classe." }),
  isProfessor: z.boolean().default(false),
  dataAniversario: z.string().optional(),
  telefone: z.string().optional(),
  estadoCivil: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  tempoConversao: z.string().optional(),
});

type PersonFormValues = z.infer<typeof personSchema>;

interface ClassOption extends DocumentData {
  id: string;
  className: string;
  establishmentName: string;
  establishmentId: string;
  establishmentType: 'sede' | 'congregacao';
}

const estadoCivilOptions = [
  { value: "Solteiro(a)", label: "Solteiro(a)" },
  { value: "Casado(a)", label: "Casado(a)" },
  { value: "Divorciado(a)", label: "Divorciado(a)" },
  { value: "Viúvo(a)", label: "Viúvo(a)" },
  { value: "Outro", label: "Outro" },
];

export default function PersonFormPage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const personIdToEdit = searchParams.get('id');
  const isEditMode = !!personIdToEdit;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingData, setLoadingData] = useState(true); 


  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      nomeCompleto: "",
      idade: undefined,
      classId: "",
      isProfessor: false,
      dataAniversario: "",
      telefone: "",
      estadoCivil: "",
      rua: "",
      numero: "",
      bairro: "",
      tempoConversao: "",
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Acesso Negado", description: "Por favor, faça login para continuar.", variant: "destructive" });
      router.replace('/login');
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    const fetchData = async () => {
      if (user && db) {
        setLoadingData(true);
        try {
          const qClasses = query(collection(db, "classes"), where("adminUid", "==", user.uid));
          const querySnapshotClasses = await getDocs(qClasses);
          const fetchedClasses = querySnapshotClasses.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as ClassOption));
          setClasses(fetchedClasses);

          if (isEditMode && personIdToEdit) {
            const personDocRef = doc(db, "people", personIdToEdit);
            const personDocSnap = await getDoc(personDocRef);
            if (personDocSnap.exists()) {
              const personData = personDocSnap.data() as PersonFormValues;
              if (personDocSnap.data().adminUid === user.uid) {
                form.reset(personData);
              } else {
                toast({ title: "Acesso Negado", description: "Você não tem permissão para editar esta pessoa.", variant: "destructive" });
                router.push('/students'); 
              }
            } else {
              toast({ title: "Pessoa não encontrada", description: "Não foi possível encontrar os dados da pessoa para edição.", variant: "destructive" });
              router.push('/students');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, authLoading, isEditMode, personIdToEdit]); // form and router removed to avoid re-runs from their instances

  const onSubmit = async (data: PersonFormValues) => {
    if (!user || !db) {
      toast({ title: "Erro", description: "Informações essenciais ausentes.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const selectedClass = classes.find(c => c.id === data.classId);
    if (!selectedClass && classes.length > 0) { // Only error if classes were loaded and none selected
      toast({ title: "Erro", description: "Classe selecionada não encontrada ou inválida.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    // If in edit mode, class might not be re-selected but exists in current form values
    const currentClassId = form.getValues("classId");
    const classDetailsForPayload = selectedClass || classes.find(c => c.id === currentClassId);

    if (!classDetailsForPayload) {
        toast({ title: "Erro", description: "Não foi possível determinar a classe para esta pessoa.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }


    const payload = {
        adminUid: user.uid,
        nomeCompleto: data.nomeCompleto,
        idade: data.idade,
        classId: data.classId,
        isProfessor: data.isProfessor,
        dataAniversario: data.dataAniversario || "",
        telefone: data.telefone || "",
        estadoCivil: data.estadoCivil || "",
        rua: data.rua || "",
        numero: data.numero || "",
        bairro: data.bairro || "",
        tempoConversao: data.tempoConversao || "",
        className: classDetailsForPayload.className,
        establishmentId: classDetailsForPayload.establishmentId,
        establishmentName: classDetailsForPayload.establishmentName.replace(' (Sede)',''),
        establishmentType: classDetailsForPayload.establishmentType,
    };

    try {
      if (isEditMode && personIdToEdit) {
        const personDocRef = doc(db, "people", personIdToEdit);
        await updateDoc(personDocRef, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Dados Atualizados!", description: `${data.nomeCompleto} foi atualizado(a) com sucesso.` });
        router.push(`/students/class-details/${data.classId}`);
      } else {
        await addDoc(collection(db, "people"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast({ title: `${data.isProfessor ? 'Professor(a)' : 'Aluno(a)'} Cadastrado(a)!`, description: `${data.nomeCompleto} foi registrado(a) com sucesso.` });
        form.reset();
      }
    } catch (error: any) {
      toast({
        title: isEditMode ? "Falha ao Atualizar" : "Falha ao Cadastrar",
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

  if (classes.length === 0 && !loadingData && !isEditMode) {
    return (
      <Card className="w-full max-w-lg border-destructive shadow-none">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl font-bold text-destructive">Nenhuma Classe Encontrada</CardTitle>
          <CardDescription className="text-muted-foreground">
            Você precisa cadastrar classes antes de poder registrar alunos ou professores.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="shadow-none">
            <Link href="/register/class-form">Cadastrar Classe</Link>
          </Button>
          <Button variant="outline" className="ml-2 shadow-none" onClick={() => router.push('/registration')}>
            Voltar para Cadastros
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl shadow-none">
      <CardHeader className="text-center">
        <UserPlus className="mx-auto h-10 w-10 text-primary" />
        <CardTitle className="text-2xl font-bold text-primary">
          {isEditMode ? "Editar Dados da Pessoa" : "Cadastro de Alunos e Professores"}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {isEditMode ? "Altere os dados conforme necessário." : "Preencha os dados para registrar um novo membro."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nomeCompleto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Nome Completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo da pessoa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="idade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />Idade</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Idade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><School className="mr-2 h-4 w-4 text-muted-foreground" />Classe</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a classe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.className} ({c.establishmentName.replace(' (Sede)', '')} - {c.establishmentType === 'sede' ? 'Sede' : 'Congregação'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isProfessor"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Button
                      type="button"
                      variant={field.value ? "default" : "outline"}
                      className="w-full shadow-none flex items-center"
                      onClick={() => field.onChange(!field.value)}
                    >
                      <Briefcase className="mr-2 h-4 w-4" />
                      {field.value ? "Cadastrado como Professor" : "Cadastrar como Professor"}
                    </Button>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Accordion type="single" collapsible className="w-full" defaultValue={isEditMode ? "item-1" : undefined}>
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-primary hover:no-underline">Cadastro Completo (Opcional)</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="dataAniversario"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />Data de Aniversário</FormLabel>
                        <FormControl>
                          <Input type="date" placeholder="DD/MM/AAAA" {...field} />
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
                  <FormField
                    control={form.control}
                    name="estadoCivil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><HeartHandshake className="mr-2 h-4 w-4 text-muted-foreground" />Estado Civil</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o estado civil" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {estadoCivilOptions.map((option) => (
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
                  
                  <div className="space-y-2">
                    <Label className="flex items-center"><Home className="mr-2 h-4 w-4 text-muted-foreground" />Endereço de Residência</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                        control={form.control}
                        name="rua"
                        render={({ field }) => (
                            <FormItem className="md:col-span-2">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                                <Input placeholder="Nome da rua" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="numero"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                                <Input placeholder="Nº" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                    <FormField
                        control={form.control}
                        name="bairro"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                                <Input placeholder="Nome do bairro" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                  </div>

                  <FormField
                    control={form.control}
                    name="tempoConversao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4 text-muted-foreground" />Tempo de Conversão</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 5 anos, Desde a infância" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-md shadow-none"
              disabled={isSubmitting || authLoading || loadingData}
            >
              {(isSubmitting || loadingData) && <LoadingSpinner size={20} className="mr-2" />}
              {isEditMode ? "Salvar Alterações" : "Salvar Cadastro"}
            </Button>
          </form>
        </Form>
         <Button
            type="button"
            variant="outline"
            className="w-full mt-4 shadow-none flex items-center"
            onClick={() => {
              if (isEditMode) {
                const classIdFromForm = form.getValues("classId");
                if (classIdFromForm) {
                  router.push(`/students/class-details/${classIdFromForm}`);
                } else {
                  router.push('/students'); 
                }
              } else {
                router.push('/registration');
              }
            }}
            disabled={isSubmitting}
        >
            <ArrowLeft className="mr-2 h-4 w-4"/> Voltar
        </Button>
      </CardContent>
    </Card>
  );
}
