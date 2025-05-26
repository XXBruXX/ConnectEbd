
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, DocumentData, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building, MapPin, Home, Landmark, ShieldCheck, AlertTriangle, Pencil, Trash2, PlusCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const congregationSchema = z.object({
  nomeCongregacao: z.string().min(1, { message: "O nome da congregação é obrigatório." }),
  endereco: z.string().min(1, { message: "O endereço é obrigatório." }),
  cidade: z.string().min(1, { message: "A cidade é obrigatória." }),
  estado: z.string().min(2, { message: "O estado é obrigatório (ex: SP)." }).max(50, { message: "Estado muito longo."}),
});

type CongregationFormValues = z.infer<typeof congregationSchema>;

interface HeadquartersChurchInfo {
  id: string;
  nomeIgreja: string;
}

interface ExistingCongregation extends DocumentData {
  id: string;
  nomeCongregacao: string;
}

export default function CongregationManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [headquartersChurch, setHeadquartersChurch] = useState<HeadquartersChurchInfo | null>(null);
  const [loadingData, setLoadingData] = useState(true); 
  const [existingCongregations, setExistingCongregations] = useState<ExistingCongregation[]>([]);
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [congregationToDelete, setCongregationToDelete] = useState<ExistingCongregation | null>(null);

  const form = useForm<CongregationFormValues>({
    resolver: zodResolver(congregationSchema),
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

  const fetchPageData = async () => {
    if (user && db) {
      setLoadingData(true);
      let hqFound = false;
      try {
        // Fetch headquarters church
        const hqQuery = query(collection(db, "churches"), where("adminUid", "==", user.uid), limit(1));
        const hqSnapshot = await getDocs(hqQuery);
        if (!hqSnapshot.empty) {
          const churchDoc = hqSnapshot.docs[0];
          setHeadquartersChurch({
            id: churchDoc.id,
            nomeIgreja: churchDoc.data().nomeIgreja,
          });
          hqFound = true;
        } else {
          setHeadquartersChurch(null);
        }

        if (hqFound) { 
            const congQuery = query(collection(db, "congregations"), where("adminUid", "==", user.uid), where("headquartersChurchId", "==", hqSnapshot.docs[0].id));
            const congSnapshot = await getDocs(congQuery);
            const congregationsData = congSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExistingCongregation))
                                          .sort((a,b) => a.nomeCongregacao.localeCompare(b.nomeCongregacao));
            setExistingCongregations(congregationsData);
        } else {
             setExistingCongregations([]);
        }

      } catch (error) {
        console.error("Error fetching page data: ", error);
        toast({ title: "Erro ao Carregar Dados", description: "Não foi possível buscar os dados da página.", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    } else if (!authLoading && !user) {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchPageData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, authLoading]);

  const onSubmitNewCongregation = async (data: CongregationFormValues) => {
    if (!user || !db || !headquartersChurch) {
      toast({ title: "Erro", description: "Informações essenciais ausentes para cadastrar.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "congregations"), {
        adminUid: user.uid,
        headquartersChurchId: headquartersChurch.id,
        headquartersChurchName: headquartersChurch.nomeIgreja,
        ...data,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Congregação Cadastrada!", description: `A congregação "${data.nomeCongregacao}" foi registrada com sucesso.` });
      form.reset(); 
      fetchPageData(); 
    } catch (error: any) {
      toast({
        title: "Falha ao Cadastrar Congregação",
        description: "Não foi possível salvar as informações. Tente novamente." + (error.message ? ` (${error.message})` : ''),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (congregation: ExistingCongregation) => {
    setCongregationToDelete(congregation);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteCongregation = async () => {
    if (!congregationToDelete || !db || !user) {
      toast({ title: "Erro", description: "Não foi possível identificar a congregação para exclusão.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      // Start a batch write
      const batch = writeBatch(db);

      // Query for classes linked to this congregation
      const classesQuery = query(
        collection(db, "classes"),
        where("adminUid", "==", user.uid),
        where("establishmentId", "==", congregationToDelete.id)
      );
      const classesSnapshot = await getDocs(classesQuery);

      // Add delete operations for each linked class to the batch
      classesSnapshot.forEach(classDoc => {
        batch.delete(doc(db, "classes", classDoc.id));
      });

      // Add delete operation for the congregation itself to the batch
      batch.delete(doc(db, "congregations", congregationToDelete.id));

      // Commit the batch
      await batch.commit();

      toast({ title: "Exclusão Completa!", description: `A congregação "${congregationToDelete.nomeCongregacao}" e todas as suas classes vinculadas foram excluídas com sucesso.` });
      fetchPageData(); // Re-fetch data
    } catch (error) {
      console.error("Error deleting congregation and linked classes: ", error);
      toast({ title: "Erro ao Excluir", description: "Não foi possível excluir a congregação e/ou suas classes.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setCongregationToDelete(null);
    }
  };


  if (authLoading || loadingData) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center"><p>Redirecionando para login...</p></div>;
  }

  if (!headquartersChurch && !loadingData) {
    return (
      <Card className="w-full max-w-lg border-destructive shadow-none">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="text-2xl font-bold text-destructive">Igreja Sede Necessária</CardTitle>
          <CardDescription className="text-muted-foreground">
            Você precisa ter uma igreja sede cadastrada para poder gerenciar congregações.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild className="shadow-none">
            <Link href="/register/church-info">Cadastrar Igreja Sede</Link>
          </Button>
          <Button variant="outline" className="ml-2 shadow-none" onClick={() => router.push('/registration')}>
            Voltar para Cadastros
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-8">
      <Card className="shadow-none">
        <CardHeader className="text-center">
          <Building className="mx-auto h-10 w-10 text-primary" />
          <CardTitle className="text-2xl font-bold text-primary">Gerenciar Congregações</CardTitle>
          <CardDescription className="text-muted-foreground">
            Visualize suas congregações cadastradas e adicione novas filiais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 p-4 text-center mb-6">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-primary">Igreja Sede Vinculada:</p>
            <p className="text-lg font-semibold text-primary">{headquartersChurch?.nomeIgreja}</p>
          </div>

          {existingCongregations.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-3">Congregações Cadastradas:</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {existingCongregations.map((cong) => (
                  <Card key={cong.id} className="flex justify-between items-center p-3 bg-background hover:border-primary/30 shadow-none">
                    <span className="text-md text-foreground truncate flex-1">{cong.nomeCongregacao}</span>
                    <div className="flex gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => router.push(`/register/congregation-form/edit/${cong.id}`)}
                        title={`Editar ${cong.nomeCongregacao}`}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar {cong.nomeCongregacao}</span>
                      </Button>
                       <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => openDeleteDialog(cong)}
                        title={`Excluir ${cong.nomeCongregacao}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Excluir {cong.nomeCongregacao}</span>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Separator className="my-6" />
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <PlusCircle className="mr-2 h-5 w-5 text-primary"/> 
              {existingCongregations.length > 0 ? "Adicionar Nova Congregação" : "Cadastrar Primeira Congregação"}
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitNewCongregation)} className="space-y-4">
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
                  {(isSubmitting) && <LoadingSpinner size={20} className="mr-2" />}
                  Salvar Congregação
                </Button>
              </form>
            </Form>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full mt-6 shadow-none flex items-center"
            onClick={() => router.push('/registration')}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Cadastros
          </Button>
        </CardContent>
      </Card>

       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a congregação "{congregationToDelete?.nomeCongregacao}"? Todas as classes vinculadas a esta congregação também serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCongregation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
    

    