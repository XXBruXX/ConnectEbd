
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, DocumentData, Timestamp, deleteDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ArrowLeft, CalendarDays, Clock, BookOpen, CheckCircle, School, Users, Calendar as CalendarIconLucide, Trash2, PlayCircle, UserCheck, Check, Book, Users2, DollarSign, Notebook, ListChecks, FileText, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';


interface ScheduledLesson extends DocumentData {
  id: string;
  lessonDate: Timestamp;
  lessonTime: string;
  lessonNumber: number;
  quarter: number;
  lessonYear: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  adminUid: string;
  establishmentId?: string;
  establishmentName?: string;
  establishmentType?: 'sede' | 'congregacao';
}

interface ClassData extends DocumentData {
  id: string;
  className: string;
  establishmentId: string;
  establishmentName: string;
  establishmentType: 'sede' | 'congregacao';
  ageGroup: string;
}

interface Person extends DocumentData {
  id: string;
  nomeCompleto: string;
  isProfessor: boolean;
}

interface AttendanceStatus {
  [personId: string]: 'present' | 'absent';
}

interface TemporaryAttendanceData {
  classMembers: Person[];
  attendanceStatus: AttendanceStatus;
  selectedClass: ClassData | null;
}

interface AttendanceReportData extends DocumentData {
  id: string;
  lessonId: string;
  lessonNumber: number;
  lessonQuarter: number;
  lessonYear: number;
  classId: string;
  className: string;
  establishmentId: string;
  establishmentName: string;
  establishmentType: 'sede' | 'congregacao';
  lessonDate: Timestamp;
  adminUid: string;
  recordedAt: Timestamp;
  attendees: Array<{
    personId: string;
    personName: string;
    isProfessor: boolean;
    status: 'present' | 'absent';
  }>;
  biblesCount: number;
  magazinesCount: number;
  visitorsCount: number;
  offerAmount: number;
}

function getLessonDateTime(lessonDate: Timestamp, lessonTime: string): Date {
  const date = lessonDate.toDate();
  if (lessonTime && lessonTime.includes(':')) {
    const [hours, minutes] = lessonTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }
  return date;
}

const formatCurrency_ptBR = (value: string): string => {
  if (value === null || value === undefined || value.trim() === "") return "";

  let cleanValue = value.replace(/[^0-9,]/g, ""); // Allow only digits and comma

  const parts = cleanValue.split(',');
  let integerPart = parts[0].replace(/\./g, ''); // Remove existing thousand separators for re-calculation
  let decimalPart = parts.length > 1 ? parts.slice(1).join('') : undefined;

  if (decimalPart && decimalPart.length > 2) {
    decimalPart = decimalPart.substring(0, 2);
  }
  
  integerPart = integerPart.replace(/^0+(?=\d)/, ''); // Remove leading zeros unless it's the only digit

  if (integerPart === "" && decimalPart === undefined) return "";
  if (integerPart === "" && decimalPart !== undefined) integerPart = "0";


  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return decimalPart !== undefined ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

const parseCurrency_ptBR = (formattedValue: string): number => {
  if (!formattedValue) return 0;
  const numericString = formattedValue.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(numericString);
  return isNaN(parsed) ? 0 : parsed;
};


export default function LessonAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const { lessonId } = params as { lessonId: string };

  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [lesson, setLesson] = useState<ScheduledLesson | null>(null);
  const [allClasses, setAllClasses] = useState<ClassData[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<ClassData | null>(null);
  const [classMembers, setClassMembers] = useState<Person[]>([]);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({});
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [biblesCount, setBiblesCount] = useState<number | string>("");
  const [magazinesCount, setMagazinesCount] = useState<number | string>("");
  const [visitorsCount, setVisitorsCount] = useState<number | string>("");
  const [offerAmount, setOfferAmount] = useState<string>(""); // Changed to string
  const [isSavingFullReport, setIsSavingFullReport] = useState(false);
  const [tempAttendanceData, setTempAttendanceData] = useState<TemporaryAttendanceData | null>(null);

  const [attendanceReports, setAttendanceReports] = useState<AttendanceReportData[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);


  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchAttendanceReports = useCallback(async () => {
    if (!user || !db || !lessonId) return;
    setLoadingReports(true);
    // console.log("Fetching reports for lessonId:", lessonId, "user UID:", user.uid);
    try {
      const reportsQuery = query(
        collection(db, "lessonAttendances"),
        where("adminUid", "==", user.uid),
        where("lessonId", "==", lessonId)
      );
      const querySnapshot = await getDocs(reportsQuery);
      // console.log("Raw reports snapshot size:", querySnapshot.size);
      const fetchedReports = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AttendanceReportData)).sort((a,b) => a.className.localeCompare(b.className)); // Sort here after fetching

      setAttendanceReports(fetchedReports);
      // console.log("Fetched reports data:", fetchedReports);
    } catch (error: any) {
      console.error("Error fetching attendance reports:", error);
      toast({ title: "Erro ao Carregar Relatórios", description: "Não foi possível buscar os relatórios de presença.", variant: "destructive" });
      setAttendanceReports([]);
    } finally {
      setLoadingReports(false);
    }
  }, [user, db, lessonId, toast]);


  const fetchLessonDetailsAndAllClasses = useCallback(async () => {
    if (user && db && lessonId) {
      setLoadingData(true);
      try {
        const lessonDocRef = doc(db, "scheduledLessons", lessonId);
        const lessonDocSnap = await getDoc(lessonDocRef);

        if (lessonDocSnap.exists() && lessonDocSnap.data().adminUid === user.uid) {
          const lessonData = { id: lessonDocSnap.id, ...lessonDocSnap.data() } as ScheduledLesson;
          setLesson(lessonData);

          const classesQueryBase = collection(db, "classes");
          let classesQueryFiltered;

          if (lessonData.establishmentId) {
            classesQueryFiltered = query(
              classesQueryBase,
              where("adminUid", "==", user.uid),
              where("establishmentId", "==", lessonData.establishmentId)
            );
          } else {
            classesQueryFiltered = query(
              classesQueryBase,
              where("adminUid", "==", user.uid)
            );
          }
          
          const querySnapshotClasses = await getDocs(classesQueryFiltered);
          const fetchedClasses = querySnapshotClasses.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ClassData))
            .sort((a, b) => {
              // Prioritize Sede, then sort by establishment name, then by class name
              const typeA = a.establishmentType;
              const typeB = b.establishmentType;
              const nameA = a.establishmentName.toLowerCase();
              const nameB = b.establishmentName.toLowerCase();
              const classNameA = a.className.toLowerCase();
              const classNameB = b.className.toLowerCase();

              if (typeA === 'sede' && typeB !== 'sede') return -1;
              if (typeA !== 'sede' && typeB === 'sede') return 1;
              if (nameA < nameB) return -1;
              if (nameA > nameB) return 1;
              if (classNameA < classNameB) return -1;
              if (classNameA > classNameB) return 1;
              return 0;
            });
          setAllClasses(fetchedClasses);


          if (lessonData.status === 'completed') {
            await fetchAttendanceReports();
          }
        } else {
          toast({ title: "Erro", description: "Aula não encontrada ou acesso não autorizado.", variant: "destructive" });
          router.push('/schedule');
        }
      } catch (error) {
        console.error("Error fetching lesson details or classes: ", error);
        toast({ title: "Erro ao Carregar Dados", description: "Não foi possível carregar os detalhes da aula ou as classes.", variant: "destructive" });
      } finally {
        setLoadingData(false);
      }
    } else if (!authLoading) {
      setLoadingData(false);
    }
  }, [user, db, lessonId, toast, router, fetchAttendanceReports]);

  useEffect(() => {
    if (user && db && lessonId && !authLoading) {
      fetchLessonDetailsAndAllClasses();
    }
  }, [user, db, lessonId, authLoading, fetchLessonDetailsAndAllClasses]);


  const handleFinalizeLesson = async () => {
    if (!db || !lesson) return;
    setIsFinalizing(true);
    try {
      const lessonDocRef = doc(db, "scheduledLessons", lesson.id);
      await updateDoc(lessonDocRef, { status: 'completed' });
      const updatedLesson = { ...lesson, status: 'completed' } as ScheduledLesson;
      setLesson(updatedLesson);
      toast({ title: "Aula Finalizada!", description: "A presença para esta aula não pode mais ser alterada." });
      await fetchAttendanceReports();
    } catch (error) {
      console.error("Error finalizing lesson: ", error);
      toast({ title: "Erro ao Finalizar", description: "Não foi possível finalizar a aula.", variant: "destructive" });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!db || !lesson || !user) {
      toast({ title: "Erro", description: "Aula não encontrada para exclusão.", variant: "destructive" });
      return;
    }
    try {
      const reportsQuery = query(collection(db, "lessonAttendances"), where("lessonId", "==", lesson.id), where("adminUid", "==", user.uid));
      const reportsSnapshot = await getDocs(reportsQuery);

      const deletePromises: Promise<void>[] = [];
      reportsSnapshot.forEach(reportDoc => {
        deletePromises.push(deleteDoc(doc(db, "lessonAttendances", reportDoc.id)));
      });

      await Promise.all(deletePromises);
      // console.log(`Deleted ${deletePromises.length} attendance reports for lesson ${lesson.id}`);

      await deleteDoc(doc(db, "scheduledLessons", lesson.id));
      toast({ title: "Aula Excluída!", description: "A aula agendada e seus relatórios foram removidos." });
      router.push('/schedule');
    } catch (error: any) {
      console.error("Error deleting lesson and reports: ", error);
      toast({ title: "Erro ao Excluir", description: "Não foi possível excluir a aula e/ou seus relatórios.", variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const fetchClassMembers = async (classId: string) => {
    if (!user || !db) return;
    setLoadingMembers(true);
    try {
      const q = query(collection(db, "people"), where("adminUid", "==", user.uid), where("classId", "==", classId));
      const querySnapshot = await getDocs(q);
      const members = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Person))
        .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
      setClassMembers(members);
      const initialAttendance: AttendanceStatus = {};
      members.forEach(member => {
        initialAttendance[member.id] = 'absent'; 
      });
      setAttendanceStatus(initialAttendance);
    } catch (error) {
      console.error("Error fetching class members: ", error);
      toast({ title: "Erro ao Carregar Membros", description: "Não foi possível carregar os membros da classe.", variant: "destructive" });
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenAttendanceDialog = (cls: ClassData) => {
    setSelectedClassForAttendance(cls);
    fetchClassMembers(cls.id);
    setIsAttendanceDialogOpen(true);
  };

  const toggleAttendance = (personId: string) => {
    setAttendanceStatus(prev => ({
      ...prev,
      [personId]: prev[personId] === 'present' ? 'absent' : 'present',
    }));
  };

  const handleProceedToSummary = () => {
    if (!selectedClassForAttendance) {
      toast({ title: "Erro", description: "Classe não selecionada.", variant: "destructive" });
      return;
    }
    setTempAttendanceData({
      classMembers,
      attendanceStatus,
      selectedClass: selectedClassForAttendance
    });
    setIsAttendanceDialogOpen(false);
    setIsSummaryDialogOpen(true);
    setBiblesCount("");
    setMagazinesCount("");
    setVisitorsCount("");
    setOfferAmount("");
  };

  const handleSaveFullReport = async () => {
    if (!db || !user || !lesson || !tempAttendanceData || !tempAttendanceData.selectedClass) {
      toast({ title: "Erro", description: "Dados insuficientes para salvar o relatório.", variant: "destructive" });
      return;
    }
    setIsSavingFullReport(true);
    // console.log("Attempting to save report for lesson:", lesson.id, "by user:", user.uid, "for class:", tempAttendanceData.selectedClass.className);

    const reportDataToSave = {
      lessonId: lesson.id,
      lessonNumber: lesson.lessonNumber,
      lessonQuarter: lesson.quarter,
      lessonYear: lesson.lessonYear,
      classId: tempAttendanceData.selectedClass.id,
      className: tempAttendanceData.selectedClass.className,
      establishmentId: tempAttendanceData.selectedClass.establishmentId,
      establishmentName: tempAttendanceData.selectedClass.establishmentName,
      establishmentType: tempAttendanceData.selectedClass.establishmentType,
      lessonDate: lesson.lessonDate,
      adminUid: user.uid,
      recordedAt: serverTimestamp(),
      attendees: tempAttendanceData.classMembers.map(member => ({
        personId: member.id,
        personName: member.nomeCompleto,
        isProfessor: member.isProfessor,
        status: tempAttendanceData.attendanceStatus[member.id] || 'absent',
      })),
      biblesCount: Number(biblesCount) || 0,
      magazinesCount: Number(magazinesCount) || 0,
      visitorsCount: Number(visitorsCount) || 0,
      offerAmount: parseCurrency_ptBR(offerAmount),
    };
    // console.log("Report data to save:", JSON.stringify(reportDataToSave, null, 2));

    try {
      await addDoc(collection(db, "lessonAttendances"), reportDataToSave);
      // console.log("Report saved successfully to Firestore for lessonId:", lesson.id);
      toast({ title: "Relatório Salvo!", description: `O relatório completo para ${tempAttendanceData.selectedClass.className} foi salvo.` });
      setIsSummaryDialogOpen(false);
      setTempAttendanceData(null);
      setSelectedClassForAttendance(null);
      setClassMembers([]);
      setAttendanceStatus({});
      if (lesson.status === 'completed') {
        await fetchAttendanceReports(); 
      }
    } catch (error: any) {
      console.error("Error saving full report: ", error);
      toast({ title: "Erro ao Salvar Relatório", description: "Não foi possível salvar o relatório completo.", variant: "destructive" });
    } finally {
      setIsSavingFullReport(false);
    }
  };

  const calculateAttendanceCounts = (attendees: AttendanceReportData['attendees']) => {
    let present = 0;
    let absent = 0;
    attendees.forEach(att => {
      if (att.status === 'present') present++;
      else absent++;
    });
    return { present, absent };
  };


  if (authLoading || loadingData) {
    return <LoadingSpinner fullScreen />;
  }

  if (!lesson) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <CalendarDays className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold">Aula não encontrada</h1>
        <Button onClick={() => router.push('/schedule')} variant="outline" className="shadow-none">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Agenda
        </Button>
      </div>
    );
  }

  const isLessonCompleted = lesson.status === 'completed';
  const lessonDateTime = getLessonDateTime(lesson.lessonDate, lesson.lessonTime);
  const isLessonInProgress = !isLessonCompleted && lesson.status === 'scheduled' && now >= lessonDateTime;

  let displayStatusText = 'Agendada';
  let StatusIcon = Clock;
  let statusColor = 'text-muted-foreground'; // Default color

  if (isLessonCompleted) {
    displayStatusText = 'Finalizada';
    StatusIcon = CheckCircle;
    statusColor = 'text-green-600 dark:text-green-500';
  } else if (isLessonInProgress) {
    displayStatusText = 'Em Andamento';
    StatusIcon = PlayCircle;
    statusColor = 'text-yellow-600 dark:text-yellow-500';
  } else {
    displayStatusText = 'Agendada';
    StatusIcon = Clock;
    statusColor = 'text-blue-600 dark:text-blue-500';
  }


  const groupedClasses: { [key: string]: ClassData[] } = allClasses.reduce((acc, cls) => {
    const key = `${cls.establishmentName} (${cls.establishmentType === 'sede' ? 'Sede' : 'Congregação'})`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cls);
    return acc;
  }, {} as { [key: string]: ClassData[] });

  const establishmentKeys = Object.keys(groupedClasses).sort((a, b) => {
    const typeA_is_sede = a.includes('(Sede)');
    const typeB_is_sede = b.includes('(Sede)');

    if (typeA_is_sede && !typeB_is_sede) return -1;
    if (!typeA_is_sede && typeB_is_sede) return 1;
    return a.localeCompare(b);
  });


  return (
    <div className="space-y-6">
      <Button onClick={() => router.push('/schedule')} variant="outline" className="mb-2 shadow-none">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Agenda
      </Button>

      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start pb-3 gap-2">
          <div>
            <CardTitle className="text-2xl text-primary flex items-center gap-2">
              <BookOpen className="h-7 w-7" />
              Lição {lesson.lessonNumber} - {lesson.quarter}º Trimestre
              {lesson.lessonYear && <span className="text-lg text-muted-foreground"> / {lesson.lessonYear}</span>}
            </CardTitle>
            <CardDescription>
              {lesson.establishmentName && `Estabelecimento: ${lesson.establishmentName} (${lesson.establishmentType === 'sede' ? 'Sede' : 'Congregação'})`}
              <br/>
              {isLessonCompleted ? "Relatório da aula finalizada." : "Gerencie a presença dos alunos para esta aula."}
            </CardDescription>
          </div>
          <div className="text-right text-sm text-muted-foreground space-y-0.5 sm:min-w-[120px]">
            <p className="flex items-center justify-end gap-1">
              <CalendarIconLucide className="h-4 w-4" />
              {format(lesson.lessonDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
            </p>
            <p className="flex items-center justify-end gap-1">
              <Clock className="h-4 w-4" />
              {lesson.lessonTime}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <p className={`flex items-center text-md ${statusColor}`}>
            <StatusIcon className={`mr-2 h-5 w-5`} />
            Status: <span className="ml-1 font-semibold">
              {displayStatusText}
            </span>
          </p>
        </CardContent>
      </Card>

      {isLessonCompleted ? (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Relatórios de Presença da Aula
            </CardTitle>
            <CardDescription>
              Lição {lesson.lessonNumber} - {lesson.quarter}º Trimestre {lesson.lessonYear && `/ ${lesson.lessonYear}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingReports ? (
              <LoadingSpinner />
            ) : attendanceReports.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum relatório de presença encontrado para esta aula.</p>
            ) : (
              <div className="space-y-4">
                {attendanceReports.map(report => {
                  const { present, absent } = calculateAttendanceCounts(report.attendees);
                  return (
                    <Card key={report.id} className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg text-primary">{report.className}</CardTitle>
                        <CardDescription>
                          {report.establishmentName} ({report.establishmentType === 'sede' ? 'Sede' : 'Congregação'})
                          <br/>
                          Registrado em: {report.recordedAt ? format(report.recordedAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <p><span className="font-medium">Presentes:</span> {present}</p>
                        <p><span className="font-medium">Ausentes:</span> {absent}</p>
                        <p><span className="font-medium">Bíblias:</span> {report.biblesCount}</p>
                        <p><span className="font-medium">Revistas:</span> {report.magazinesCount}</p>
                        <p><span className="font-medium">Visitantes:</span> {report.visitorsCount}</p>
                        <p><span className="font-medium">Oferta:</span> R$ {report.offerAmount.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-primary flex items-center gap-2">
              <ListChecks className="h-6 w-6" />
              Relatório de Aula
            </CardTitle>
            <CardDescription>
              Escolha uma classe para marcar a presença e registrar os dados.
              {lesson?.establishmentName ? ` (Referente a: ${lesson.establishmentName})` : ' (Aula global, todas as classes serão listadas abaixo)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allClasses.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhuma classe encontrada para {lesson?.establishmentName ? `o estabelecimento ${lesson.establishmentName}` : 'este administrador'}.
                Verifique se há classes cadastradas para {lesson?.establishmentName ? 'este estabelecimento' : 'sua igreja/congregações'}.
              </p>
            ) : (
              Object.keys(groupedClasses).length > 0 ? 
                establishmentKeys.map(estKey => (
                  <div key={estKey} className="mb-4 last:mb-0">
                    <h3 className="text-md font-semibold text-primary mb-2 flex items-center gap-2 border-b pb-1">
                      <Building className="h-5 w-5"/>
                      {estKey}
                    </h3>
                    {groupedClasses[estKey].map((cls) => (
                      <Button
                        key={cls.id}
                        variant="outline"
                        className="w-full justify-start p-4 h-auto text-left mb-2 shadow-none"
                        onClick={() => handleOpenAttendanceDialog(cls)}
                        disabled={isLessonCompleted}
                        title={isLessonCompleted ? "Não é possível registrar presença, aula finalizada." : `Registrar presença para ${cls.className}`}
                      >
                        <div className="flex flex-col w-full">
                          <span className="font-medium text-md text-primary">{cls.className}</span>
                          <span className="text-xs text-muted-foreground">{cls.ageGroup}</span>
                        </div>
                        {!isLessonCompleted && <Users className="ml-auto h-5 w-5 text-muted-foreground" />}
                      </Button>
                    ))}
                  </div>
                ))
              : (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma classe encontrada para o estabelecimento selecionado para esta aula.
                </p>
              )
            )}
          </CardContent>
        </Card>
      )}

      {!isLessonCompleted && (
        <div className="mt-6 pt-6 border-t">
          <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-end items-center gap-2 px-0">
            <Button
              variant="outline"
              size="icon"
              className="text-destructive hover:text-destructive hover:border-destructive hover:bg-destructive/10 h-10 w-10 shrink-0 shadow-none"
              onClick={() => setIsDeleteDialogOpen(true)}
              title="Excluir Aula Agendada"
            >
              <Trash2 className="h-5 w-5" />
              <span className="sr-only">Excluir Aula</span>
            </Button>
            <Button
              onClick={handleFinalizeLesson}
              disabled={isFinalizing}
              className="w-full sm:w-auto shadow-none"
            >
              {isFinalizing && <LoadingSpinner size={16} className="mr-2" />}
              <CheckCircle className="mr-2 h-4 w-4" />Finalizar Aula
            </Button>
          </CardFooter>
        </div>
      )}


      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula agendada (Lição {lesson?.lessonNumber}, {lesson?.quarter}º Trimestre {lesson?.lessonYear ? `/ ${lesson.lessonYear}` : ''})? Todos os relatórios de presença associados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Presença - {selectedClassForAttendance?.className}</DialogTitle>
            <DialogDescription>
              Lição {lesson?.lessonNumber} ({lesson?.quarter}º Trim {lesson?.lessonYear && `/ ${lesson.lessonYear}`}) - {lesson?.lessonDate ? format(lesson.lessonDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : ''}
              <br/>
              <span className="text-xs text-muted-foreground">{selectedClassForAttendance?.establishmentName} ({selectedClassForAttendance?.establishmentType === 'sede' ? 'Sede' : 'Congregação'})</span>
            </DialogDescription>
          </DialogHeader>
          {loadingMembers ? (
            <LoadingSpinner className="my-8" />
          ) : classMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum aluno ou professor cadastrado nesta classe.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {classMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center">
                    {member.isProfessor ? <UserCheck className="mr-2 h-5 w-5 text-primary" /> : <Users className="mr-2 h-5 w-5 text-primary/70" />}
                    <span className="text-sm">{member.nomeCompleto} {member.isProfessor && "(P)"}</span>
                  </div>
                  <Button
                    variant={attendanceStatus[member.id] === 'present' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleAttendance(member.id)}
                    className="shadow-none w-36"
                  >
                    {attendanceStatus[member.id] === 'present' ? <Check className="mr-2 h-4 w-4" /> : null}
                    {attendanceStatus[member.id] === 'present' ? 'Presente' : 'Marcar Presença'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="shadow-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleProceedToSummary}
              disabled={loadingMembers || classMembers.length === 0}
              className="shadow-none"
            >
              Próximo Registro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumo da Aula - {tempAttendanceData?.selectedClass?.className}</DialogTitle>
            <DialogDescription>
              Lição {lesson?.lessonNumber} ({lesson?.quarter}º Trim {lesson?.lessonYear && `/ ${lesson.lessonYear}`}) - {lesson?.lessonDate ? format(lesson.lessonDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : ''}
              <br/>
              <span className="text-xs text-muted-foreground">{tempAttendanceData?.selectedClass?.establishmentName} ({tempAttendanceData?.selectedClass?.establishmentType === 'sede' ? 'Sede' : 'Congregação'})</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="biblesCount" className="flex items-center"><Book className="mr-2 h-4 w-4 text-muted-foreground" />Bíblias</Label>
                <Input
                  id="biblesCount"
                  type="number"
                  value={biblesCount}
                  onChange={(e) => setBiblesCount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="shadow-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="magazinesCount" className="flex items-center"><Notebook className="mr-2 h-4 w-4 text-muted-foreground" />Revistas</Label>
                <Input
                  id="magazinesCount"
                  type="number"
                  value={magazinesCount}
                  onChange={(e) => setMagazinesCount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="shadow-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="visitorsCount" className="flex items-center"><Users2 className="mr-2 h-4 w-4 text-muted-foreground" />Visitantes</Label>
                <Input
                  id="visitorsCount"
                  type="number"
                  value={visitorsCount}
                  onChange={(e) => setVisitorsCount(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="shadow-none"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="offerAmount" className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />Oferta (R$)</Label>
                <Input
                  id="offerAmount"
                  type="text"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(formatCurrency_ptBR(e.target.value))}
                  placeholder="0,00"
                  className="shadow-none"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSavingFullReport} className="shadow-none">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSaveFullReport}
              disabled={isSavingFullReport}
              className="shadow-none"
            >
              {isSavingFullReport && <LoadingSpinner size={16} className="mr-2" />}
              Concluir Relatório da Classe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
