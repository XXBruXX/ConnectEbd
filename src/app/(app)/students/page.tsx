
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building, School, Users as UsersIcon, ChevronRight, PlusCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Person extends DocumentData {
  id: string;
  nomeCompleto: string;
  isProfessor: boolean;
  classId: string;
  className: string; 
  establishmentId: string; 
  establishmentName: string; 
  establishmentType: 'sede' | 'congregacao'; 
}

interface ClassInfo extends DocumentData {
  id: string;
  className: string;
  ageGroup: string;
  establishmentId: string;
  establishmentName: string;
  establishmentType: 'sede' | 'congregacao';
}

interface ProcessedClass extends ClassInfo {
  studentCount: number;
  teacherCount: number;
}

interface ProcessedEstablishment {
  id: string;
  name: string;
  type: 'sede' | 'congregacao';
  classes: ProcessedClass[];
}

export default function StudentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const [processedEstablishments, setProcessedEstablishments] = useState<ProcessedEstablishment[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      if (user && db) {
        setLoadingData(true);
        try {
          const classesQuery = query(collection(db, "classes"), where("adminUid", "==", user.uid));
          const classesSnapshot = await getDocs(classesQuery);
          const allClasses = classesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo));

          const peopleQuery = query(collection(db, "people"), where("adminUid", "==", user.uid));
          const peopleSnapshot = await getDocs(peopleQuery);
          const allPeople = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Person));

          const establishmentsMap = new Map<string, ProcessedEstablishment>();

          allClasses.forEach(cls => {
            if (!establishmentsMap.has(cls.establishmentId)) {
              establishmentsMap.set(cls.establishmentId, {
                id: cls.establishmentId,
                name: cls.establishmentName,
                type: cls.establishmentType,
                classes: [],
              });
            }
            const establishment = establishmentsMap.get(cls.establishmentId)!;
            
            const classPeople = allPeople.filter(p => p.classId === cls.id);
            const studentCount = classPeople.filter(p => !p.isProfessor).length;
            const teacherCount = classPeople.filter(p => p.isProfessor).length;

            establishment.classes.push({
              ...cls,
              studentCount,
              teacherCount,
            });
          });
          

          const sortedEstablishments = Array.from(establishmentsMap.values()).sort((a, b) => {
            if (a.type === 'sede' && b.type !== 'sede') return -1;
            if (a.type !== 'sede' && b.type === 'sede') return 1;
            return a.name.localeCompare(b.name);
          });

          sortedEstablishments.forEach(est => {
            est.classes.sort((a, b) => a.className.localeCompare(b.className));
          });

          setProcessedEstablishments(sortedEstablishments);
          if (sortedEstablishments.length > 0) {
            setActiveAccordionItem(sortedEstablishments[0].id);
          }

        } catch (error) {
          console.error("Error fetching student/class data: ", error);
        } finally {
          setLoadingData(false);
        }
      } else if (!authLoading) {
        setLoadingData(false);
      }
    };

    if (!authLoading && user) {
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, authLoading]);

  if (authLoading || loadingData) {
    return <LoadingSpinner fullScreen />;
  }

  if (!user) {
    return <p>Por favor, faça login para ver esta página.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="page-title flex items-center gap-3">
          <UsersIcon className="h-8 w-8" />
          Gerenciamento de Alunos e Professores
        </h1>
        <Button asChild className="shadow-md">
          <Link href="/register/person-form">
            <PlusCircle className="mr-2 h-5 w-5" />
            Nova Matrícula
          </Link>
        </Button>
      </div>

      {processedEstablishments.length === 0 && !loadingData && (
        <Card className="w-full text-center border-dashed border-border/50 shadow-lg">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <UsersIcon className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl text-foreground">Nenhum Aluno ou Professor Encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Não há alunos ou professores cadastrados ainda, ou nenhuma classe foi criada.
              Comece cadastrando classes e depois adicione pessoas a elas.
            </p>
          </CardContent>
        </Card>
      )}

      {processedEstablishments.length > 0 && (
        <Accordion 
          type="single" 
          collapsible 
          className="w-full space-y-4"
          value={activeAccordionItem}
          onValueChange={setActiveAccordionItem}
        >
          {processedEstablishments.map(establishment => (
            <AccordionItem value={establishment.id} key={establishment.id} className="border rounded-lg shadow-lg overflow-hidden bg-card">
              <AccordionTrigger className="flex items-center gap-3 p-4 hover:no-underline hover:bg-accent/50 transition-colors data-[state=open]:bg-accent/30 data-[state=open]:border-b">
                <Building className="h-7 w-7 text-primary" />
                <h2 className="text-xl font-semibold text-primary text-left flex-1">
                  {establishment.name} {establishment.type === 'sede' && '(Sede)'}
                </h2>
              </AccordionTrigger>
              <AccordionContent className="p-4 pt-2 bg-background/50 space-y-4">
                {establishment.classes.length > 0 ? (
                  <div className='space-y-3'>
                     <h3 className="text-md font-medium text-foreground pt-2 flex items-center gap-2">
                        <School className="h-5 w-5" />
                        Classes em {establishment.name}
                    </h3>
                    {establishment.classes.map(cls => (
                      <Link href={`/students/class-details/${cls.id}`} key={cls.id} passHref>
                        <Card className="shadow-md hover:shadow-lg hover:border-primary/30 transition-all duration-300 ease-in-out cursor-pointer bg-card transform hover:-translate-y-1">
                          <CardHeader className="flex flex-row items-center justify-between p-4">
                            <div>
                              <CardTitle className="text-md text-foreground">{cls.className}</CardTitle>
                              <CardDescription>{cls.ageGroup}</CardDescription>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </CardHeader>
                           <CardContent className="text-xs text-muted-foreground px-4 pb-3 pt-0">
                              <p>{cls.teacherCount} professor(es), {cls.studentCount} aluno(s)</p>
                           </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-2 pt-2">Nenhuma classe cadastrada para este estabelecimento.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
