
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, query, where, getDocs, DocumentData, doc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { School, PlusCircle, Edit3, Building, Trash2 } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";

interface ClassData extends DocumentData {
  id: string;
  className: string;
  establishmentId: string;
  establishmentName: string;
  establishmentType: 'sede' | 'congregacao';
  ageGroup: string;
}

interface GroupedClasses {
  [establishmentName: string]: ClassData[];
}

export default function ClassesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [groupedClasses, setGroupedClasses] = useState<GroupedClasses>({});
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchClasses = async () => {
    if (user && db) {
      setLoadingClasses(true);
      try {
        const q = query(
          collection(db, "classes"),
          where("adminUid", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const fetchedClasses = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ClassData));

        const groups: GroupedClasses = fetchedClasses.reduce((acc, cls) => {
          const key = cls.establishmentName || "Sem Estabelecimento Definido";
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(cls);
          return acc;
        }, {} as GroupedClasses);

        setGroupedClasses(groups);
      } catch (error) {
        console.error("Error fetching classes: ", error);
        toast({ title: "Erro ao buscar classes", description: "Não foi possível carregar as classes.", variant: "destructive" });
      } finally {
        setLoadingClasses(false);
      }
    } else if (!authLoading) {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchClasses();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, authLoading]);


  const openDeleteDialog = (classItem: ClassData) => {
    setClassToDelete(classItem);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete || !db) {
      toast({ title: "Erro", description: "Não foi possível identificar a classe para exclusão.", variant: "destructive" });
      return;
    }
    try {
      await deleteDoc(doc(db, "classes", classToDelete.id));
      toast({ title: "Classe Excluída!", description: `A classe "${classToDelete.className}" foi excluída com sucesso.` });
      
      // Optimistically update UI or re-fetch
      setGroupedClasses(prevGroups => {
        const updatedGroups = { ...prevGroups };
        const groupName = classToDelete.establishmentName;
        if (updatedGroups[groupName]) {
          updatedGroups[groupName] = updatedGroups[groupName].filter(c => c.id !== classToDelete.id);
          if (updatedGroups[groupName].length === 0) {
            delete updatedGroups[groupName];
          }
        }
        return updatedGroups;
      });

    } catch (error) {
      console.error("Error deleting class: ", error);
      toast({ title: "Erro ao Excluir", description: "Não foi possível excluir a classe.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setClassToDelete(null);
    }
  };


  if (authLoading || loadingClasses) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return null; 
  }

  const establishmentNames = Object.keys(groupedClasses).sort((a, b) => {
    const typeA = groupedClasses[a]?.[0]?.establishmentType;
    const typeB = groupedClasses[b]?.[0]?.establishmentType;

    if (typeA === 'sede' && typeB !== 'sede') {
      return -1; 
    }
    if (typeA !== 'sede' && typeB === 'sede') {
      return 1;  
    }
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="page-title flex items-center gap-2">
          <School className="h-8 w-8" />
          Gerenciamento de Classes
        </h1>
        <Button asChild className="shadow-md">
          <Link href="/register/class-form">
            <PlusCircle className="mr-2 h-5 w-5" />
            Nova Classe
          </Link>
        </Button>
      </div>

      {establishmentNames.length === 0 ? (
        <Card className="w-full text-center border-dashed border-border/50 shadow-lg">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <School className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl text-foreground">Nenhuma Classe Cadastrada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Você ainda não cadastrou nenhuma classe. Clique em "Nova Classe" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        establishmentNames.map(establishmentName => (
          <section key={establishmentName} className="space-y-4">
            <div className="flex items-center gap-3 border-b pb-2 border-border/70">
              <Building className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold text-primary">
                {establishmentName} 
                {groupedClasses[establishmentName]?.[0]?.establishmentType === 'sede' && ' (Sede)'}
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {groupedClasses[establishmentName]
                .sort((a, b) => {
                  const nameA = typeof a.className === 'string' ? a.className.toLowerCase() : '';
                  const nameB = typeof b.className === 'string' ? b.className.toLowerCase() : '';
                  if (nameA < nameB) return -1;
                  if (nameA > nameB) return 1;
                  return 0;
                })
                .map((cls) => (
                <Card key={cls.id} className="flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1">
                  <CardHeader>
                    <CardTitle className="text-lg text-foreground">{cls.className}</CardTitle>
                    <CardDescription>
                      {cls.ageGroup}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    {/* Additional class details can be added here if needed */}
                  </CardContent>
                  <CardFooter className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/register/class-form?id=${cls.id}`)}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive hover:border-destructive hover:bg-destructive/10"
                      onClick={() => openDeleteDialog(cls)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a classe "{classToDelete?.className}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClass}
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
