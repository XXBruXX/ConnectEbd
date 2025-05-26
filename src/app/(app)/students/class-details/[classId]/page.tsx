
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { doc, getDoc, collection, query, where, getDocs, DocumentData, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ArrowLeft, Users, UserCheck, School, Pencil, Trash2 } from 'lucide-react';
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
import { useToast } from "@/hooks/use-toast";

interface ClassDetails extends DocumentData {
  id: string;
  className: string;
  ageGroup: string;
  establishmentName: string;
}

interface Person extends DocumentData {
  id: string;
  nomeCompleto: string;
  isProfessor: boolean;
  // Outros campos de Person se necessário
}

export default function ClassDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params.classId as string;

  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [teachers, setTeachers] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchClassData = async () => {
    if (user && db && classId) {
      setLoadingData(true);
      try {
        const classDocRef = doc(db, "classes", classId);
        const classDocSnap = await getDoc(classDocRef);

        if (classDocSnap.exists() && classDocSnap.data().adminUid === user.uid) {
          setClassDetails({ id: classDocSnap.id, ...classDocSnap.data() } as ClassDetails);

          const peopleQuery = query(
            collection(db, "people"),
            where("adminUid", "==", user.uid),
            where("classId", "==", classId)
          );
          const peopleSnapshot = await getDocs(peopleQuery);
          const fetchedPeople = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));
          
          setTeachers(fetchedPeople.filter(p => p.isProfessor).sort((a,b) => a.nomeCompleto.localeCompare(b.nomeCompleto)));
          setStudents(fetchedPeople.filter(p => !p.isProfessor).sort((a,b) => a.nomeCompleto.localeCompare(b.nomeCompleto)));

        } else {
          console.error("Class not found or user not authorized");
          toast({ title: "Erro", description: "Classe não encontrada ou acesso não autorizado.", variant: "destructive" });
          router.push('/students');
        }
      } catch (error) {
        console.error("Error fetching class details: ", error);
        toast({ title: "Erro ao Carregar Dados", description: "Não foi possível carregar os detalhes da classe.", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    } else if (!authLoading) {
       setLoadingData(false);
    }
  };
  
  useEffect(() => {
    if (user && db && classId) {
      fetchClassData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, classId, authLoading]); 


  const openDeleteDialog = (person: Person) => {
    setPersonToDelete(person);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePerson = async () => {
    if (!personToDelete || !db) {
      toast({ title: "Erro", description: "Não foi possível identificar a pessoa para exclusão.", variant: "destructive" });
      return;
    }
    try {
      await deleteDoc(doc(db, "people", personToDelete.id));
      toast({ title: "Pessoa Excluída!", description: `"${personToDelete.nomeCompleto}" foi excluído(a) com sucesso.` });
      
      if (personToDelete.isProfessor) {
        setTeachers(prev => prev.filter(p => p.id !== personToDelete.id));
      } else {
        setStudents(prev => prev.filter(p => p.id !== personToDelete.id));
      }
    } catch (error) {
      console.error("Error deleting person: ", error);
      toast({ title: "Erro ao Excluir", description: "Não foi possível excluir a pessoa.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setPersonToDelete(null);
    }
  };

  const handleEditPerson = (personId: string) => {
    router.push(`/register/person-form?id=${personId}`);
  };

  if (authLoading || loadingData) {
    return <LoadingSpinner fullScreen />;
  }

  if (!classDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <School className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold">Classe não encontrada</h1>
        <p className="text-muted-foreground mb-4">
          Não foi possível carregar os detalhes da classe ou você não tem permissão para visualizá-la.
        </p>
        <Button onClick={() => router.push('/students')} variant="outline" className="shadow-none">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Alunos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={() => router.push('/students')} variant="outline" className="mb-6 shadow-none">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para todas as classes
      </Button>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl text-primary flex items-center gap-2">
            <School className="h-7 w-7" />
            {classDetails.className}
          </CardTitle>
          <CardDescription>
            {classDetails.ageGroup} <span className="text-muted-foreground/80">| {classDetails.establishmentName}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      {teachers.length > 0 && (
        <Card className="shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <UserCheck className="h-6 w-6" />
              Professores ({teachers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {teachers.map(teacher => (
                <li key={teacher.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border">
                  <div className="flex items-center flex-grow">
                    <UserCheck className="h-5 w-5 text-primary mr-3 shrink-0" />
                    <span className="text-md truncate">{teacher.nomeCompleto}</span>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPerson(teacher.id)}>
                      <Pencil className="h-4 w-4" /> 
                      <span className="sr-only">Editar {teacher.nomeCompleto}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(teacher)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Excluir {teacher.nomeCompleto}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
       {teachers.length === 0 && !loadingData && (
         <p className="text-sm text-muted-foreground px-1">Nenhum professor cadastrado para esta classe.</p>
       )}


      {students.length > 0 && (
        <Card className="shadow-none mt-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <Users className="h-6 w-6" />
              Alunos ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {students.map(student => (
                <li key={student.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 border">
                   <div className="flex items-center flex-grow">
                    <Users className="h-5 w-5 text-primary mr-3 shrink-0" />
                    <span className="text-md truncate">{student.nomeCompleto}</span>
                  </div>
                   <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPerson(student.id)}>
                      <Pencil className="h-4 w-4" /> 
                       <span className="sr-only">Editar {student.nomeCompleto}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog(student)}>
                      <Trash2 className="h-4 w-4" />
                       <span className="sr-only">Excluir {student.nomeCompleto}</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {students.length === 0 && !loadingData && (
         <p className="text-sm text-muted-foreground px-1 mt-2">Nenhum aluno cadastrado para esta classe.</p>
       )}

       {(students.length === 0 && teachers.length === 0 && !loadingData) && (
          <Card className="shadow-none mt-6 border-dashed">
            <CardContent className="text-center p-6">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2"/>
                <p className="text-muted-foreground">Esta classe ainda não possui alunos ou professores cadastrados.</p>
            </CardContent>
          </Card>
       )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{personToDelete?.nomeCompleto}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePerson}
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
