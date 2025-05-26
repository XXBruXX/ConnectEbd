
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { CalendarDays, PlusCircle, Calendar as CalendarIconLucide, Clock, BookOpen, Layers, Trash2, Users, PlayCircle, CheckCircle, Building } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
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
import { useRouter } from 'next/navigation';
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const currentYear = new Date().getFullYear();
const scheduleLessonSchema = z.object({
  lessonDate: z.date({ required_error: "A data da aula é obrigatória." }),
  lessonTime: z.string().min(1, "O horário da aula é obrigatório."),
  lessonNumber: z.coerce.number().min(1, "A lição deve ser no mínimo 1.").max(13, "A lição deve ser no máximo 13."),
  quarter: z.coerce.number().min(1, "O trimestre deve ser no mínimo 1.").max(4, "O trimestre deve ser no máximo 4."),
  lessonYear: z.coerce.number().min(currentYear - 1, "Ano inválido.").max(currentYear + 5, "Ano inválido."),
}).refine(data => {
  const today = startOfDay(new Date());
  const selectedCalendarDate = startOfDay(data.lessonDate);

  if (selectedCalendarDate.getTime() === today.getTime()) {
    if (!data.lessonTime) return true; // If time is not set yet, don't validate

    const now = new Date();
    const [lessonHours, lessonMinutes] = data.lessonTime.split(':').map(Number);
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Allow if lesson hour is current hour (can register for past minutes in current hour)
    if (lessonHours === currentHour) return true;
    // Allow if lesson hour is in the future
    if (lessonHours > currentHour) return true;
    // If lesson hour is past, it's invalid
    if (lessonHours < currentHour) return false;
    // This line is effectively covered by the above, but for clarity:
    // if (lessonHours === currentHour && lessonMinutes < currentMinutes) return false; // Past minutes in current hour
  }
  return true;
}, {
  message: "Para hoje, o horário não pode ser de uma hora que já passou completamente.",
  path: ["lessonTime"],
});

type ScheduleLessonFormValues = z.infer<typeof scheduleLessonSchema>;

interface ScheduledLesson extends DocumentData {
  id: string;
  lessonDate: Timestamp;
  lessonTime: string;
  lessonNumber: number;
  quarter: number;
  lessonYear: number;
  status: 'scheduled' | 'completed' | 'cancelled';
}

const lessonNumberOptions = Array.from({ length: 13 }, (_, i) => ({ value: i + 1, label: `${i + 1}ª Lição` }));
const quarterOptions = Array.from({ length: 4 }, (_, i) => ({ value: i + 1, label: `${i + 1}º Trimestre` }));
const yearOptions = Array.from({ length: 7 }, (_, i) => ({ value: currentYear - 1 + i, label: `${currentYear - 1 + i}` }));

function getLessonDateTime(lessonDate: Timestamp, lessonTime: string): Date {
  const date = lessonDate.toDate();
  if (lessonTime && lessonTime.includes(':')) {
      const [hours, minutes] = lessonTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
  }
  return date;
}

export default function SchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [isNewLessonDialogOpen, setIsNewLessonDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allLessons, setAllLessons] = useState<ScheduledLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [lessonToDelete, setLessonToDelete] = useState<ScheduledLesson | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const form = useForm<ScheduleLessonFormValues>({
    resolver: zodResolver(scheduleLessonSchema),
    defaultValues: {
      lessonDate: new Date(),
      lessonTime: "",
      lessonNumber: 1,
      quarter: 1,
      lessonYear: new Date().getFullYear(),
    },
  });

  const fetchScheduledLessons = useCallback(async () => {
    if (!user || !db) {
      setLoadingLessons(false);
      return;
    }
    setLoadingLessons(true);
    try {
      const q = query(
        collection(db, "scheduledLessons"),
        where("adminUid", "==", user.uid),
        orderBy("lessonDate", "asc")
      );
      const querySnapshot = await getDocs(q);
      const lessons = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduledLesson));
      setAllLessons(lessons);
    } catch (error: any) {
      console.error("Error fetching scheduled lessons: ", error);
       if (error.code === 'failed-precondition') {
         toast({
          title: "Índice Necessário no Firestore",
          description: (
            <span>
              Um índice é necessário para ordenar as aulas. Por favor, verifique o console do navegador para um link para criá-lo no Firebase. A consulta requer um índice em: `scheduledLessons` com `adminUid` (asc), `lessonDate` (asc). Error code: {error.code}
            </span>
          ),
          variant: "destructive",
          duration: 15000 
        });
      } else {
        toast({ title: "Erro ao Carregar Aulas", description: `Não foi possível buscar as aulas agendadas. Detalhe: ${error.message}`, variant: "destructive", duration: 7000 });
      }
    } finally {
      setLoadingLessons(false);
    }
  }, [user, db, toast]);

  useEffect(() => {
    if (!authLoading && user && db) {
      fetchScheduledLessons();
    } else if (!authLoading && !user) {
      setLoadingLessons(false);
      setAllLessons([]);
    }
  }, [authLoading, user, db, fetchScheduledLessons]);

  const onSubmit = async (data: ScheduleLessonFormValues) => {
    if (!user || !db) {
      toast({ title: "Erro de Autenticação", description: "Por favor, faça login novamente.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      const duplicateQuery = query(
        collection(db, "scheduledLessons"),
        where("adminUid", "==", user.uid),
        where("lessonNumber", "==", data.lessonNumber),
        where("quarter", "==", data.quarter),
        where("lessonYear", "==", data.lessonYear)
      );
      const duplicateSnapshot = await getDocs(duplicateQuery);
      if (!duplicateSnapshot.empty) {
        toast({
          title: "Aula Duplicada",
          description: `A lição ${data.lessonNumber} do ${data.quarter}º trimestre de ${data.lessonYear} já foi agendada.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, "scheduledLessons"), {
        adminUid: user.uid,
        lessonDate: Timestamp.fromDate(data.lessonDate),
        lessonTime: data.lessonTime,
        lessonNumber: data.lessonNumber,
        quarter: data.quarter,
        lessonYear: data.lessonYear,
        createdAt: serverTimestamp(),
        status: 'scheduled',
      });
      toast({ title: "Aula Agendada!", description: "A nova aula foi agendada com sucesso." });
      form.reset({
        lessonDate: new Date(),
        lessonTime: "",
        lessonNumber: 1,
        quarter: 1,
        lessonYear: new Date().getFullYear(),
      });
      setIsNewLessonDialogOpen(false);
      fetchScheduledLessons();
    } catch (error: any) {
      console.error("Error scheduling lesson: ", error);
      toast({ title: "Erro ao Agendar", description: `Não foi possível agendar a aula. Detalhe: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (lesson: ScheduledLesson) => {
    setLessonToDelete(lesson);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLesson = async () => {
    if (!lessonToDelete || !db || !user) return;
    try {
      
      const reportsQuery = query(collection(db, "lessonAttendances"), where("lessonId", "==", lessonToDelete.id), where("adminUid", "==", user.uid));
      const reportsSnapshot = await getDocs(reportsQuery);
      
      const batch = writeBatch(db);
      reportsSnapshot.forEach(reportDoc => {
        batch.delete(doc(db, "lessonAttendances", reportDoc.id));
      });
      batch.delete(doc(db, "scheduledLessons", lessonToDelete.id)); 
      await batch.commit();

      toast({ title: "Aula Excluída!", description: "A aula e seus relatórios foram excluídos com sucesso." });
      fetchScheduledLessons();
    } catch (error: any) {
      console.error("Error deleting lesson: ", error);
      toast({ title: "Erro ao Excluir", description: `Não foi possível excluir a aula. Detalhe: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setLessonToDelete(null);
    }
  };

  if (authLoading) {
    return <LoadingSpinner fullScreen />
  }

  const activeLessons = allLessons.filter(lesson => lesson.status === 'scheduled');
  const completedLessons = allLessons.filter(lesson => lesson.status === 'completed').sort((a,b) => b.lessonDate.toDate().getTime() - a.lessonDate.toDate().getTime());

  const renderLessonCard = (lesson: ScheduledLesson) => {
    const lessonDateTime = getLessonDateTime(lesson.lessonDate, lesson.lessonTime);
    const isCompleted = lesson.status === 'completed';
    const isInProgress = !isCompleted && lesson.status === 'scheduled' && now >= lessonDateTime;

    let displayStatusText = 'Agendada';
    let StatusIcon = Clock;
    let statusColorClass = 'text-blue-600 dark:text-blue-400';

    if (isCompleted) {
      displayStatusText = 'Finalizada';
      StatusIcon = CheckCircle;
      statusColorClass = 'text-green-600 dark:text-green-400';
    } else if (isInProgress) {
      displayStatusText = 'Em Andamento';
      StatusIcon = PlayCircle;
      statusColorClass = 'text-yellow-600 dark:text-yellow-400';
    }

    return (
      <Card key={lesson.id} className="shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-foreground">
            Lição {lesson.lessonNumber} - {lesson.quarter}º Trimestre
          </CardTitle>
          <CardDescription className="text-xs">
            Ano: {lesson.lessonYear}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="flex items-center">
            <CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />
             Data: {lesson.lessonDate ? format(lesson.lessonDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
          </p>
          <p className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            Horário: {lesson.lessonTime}
          </p>
          <p className={`flex items-center ${statusColorClass}`}>
              <StatusIcon className={`mr-2 h-4 w-4`} />
              Status: <span className="ml-1 font-medium">{displayStatusText}</span>
          </p>
        </CardContent>
          <CardFooter className="pt-3 flex justify-between items-center">
            <Button
              variant="default"
              size="sm"
              className="flex-1 shadow-md mr-2"
              onClick={() => router.push(`/schedule/attendance/${lesson.id}`)}
            >
              <Users className="mr-2 h-4 w-4" />
              {lesson.status === 'completed' ? "Exibir Relatório" : "Gerenciar Presença"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9 w-9"
              onClick={() => openDeleteDialog(lesson)}
              title="Excluir Aula"
              disabled={lesson.status === 'completed'}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Excluir Aula</span>
            </Button>
          </CardFooter>
      </Card>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="page-title flex items-center gap-2">
          <CalendarDays className="h-8 w-8" />
          Agenda de Aulas
        </h1>
        <Dialog open={isNewLessonDialogOpen} onOpenChange={setIsNewLessonDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                form.reset({
                  lessonDate: new Date(),
                  lessonTime: "",
                  lessonNumber: 1,
                  quarter: 1,
                  lessonYear: new Date().getFullYear(),
                });
                setIsNewLessonDialogOpen(true);
              }}
              className="shadow-md"
            >
              <PlusCircle className="mr-2 h-5 w-5" />
              Nova Aula
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Agendar Nova Aula</DialogTitle>
              <DialogDescription>
                Preencha os detalhes para agendar uma nova aula.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lessonNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><BookOpen className="mr-2 h-4 w-4 text-muted-foreground" />Lição</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Nº da Lição" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {lessonNumberOptions.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
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
                    name="quarter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><Layers className="mr-2 h-4 w-4 text-muted-foreground" />Trimestre</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Trimestre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {quarterOptions.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
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
                    name="lessonYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center"><CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />Ano da Aula</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {yearOptions.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
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
                  name="lessonDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="flex items-center"><CalendarIconLucide className="mr-2 h-4 w-4 text-muted-foreground" />Data da Aula</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: ptBR })
                              ) : (
                                <span>Selecione a data</span>
                              )}
                              <CalendarIconLucide className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                                if (date) field.onChange(date);
                            }}
                            disabled={(date) => date < startOfDay(new Date())}
                            initialFocus
                            locale={ptBR}
                            required
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lessonTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Horário da Aula</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} className="shadow-none"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting} className="shadow-none">
                            Cancelar
                        </Button>
                    </DialogClose>
                  <Button type="submit" disabled={isSubmitting} className="shadow-md">
                    {isSubmitting && <LoadingSpinner size={16} className="mr-2" />}
                    Salvar Aula
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-primary">Aulas Agendadas</CardTitle>
          <CardDescription>Lista das próximas aulas que ainda não foram finalizadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingLessons ? (
            <div className="flex justify-center items-center py-8">
              <LoadingSpinner />
            </div>
          ) : activeLessons.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <CalendarDays className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p className="font-medium">Nenhuma aula agendada no momento.</p>
                <p className="text-sm">Clique em "Nova Aula" para adicionar.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeLessons.map(renderLessonCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {completedLessons.length > 0 && (
        <Card className="shadow-lg mt-8">
          <CardHeader>
            <CardTitle className="text-primary">Aulas Finalizadas</CardTitle>
            <CardDescription>Histórico de aulas que já foram concluídas.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLessons ? (
              <div className="flex justify-center items-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {completedLessons.map(renderLessonCard)}
              </div>
            )}
          </CardContent>
        </Card>
      )}


       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta aula agendada (Lição {lessonToDelete?.lessonNumber}, {lessonToDelete?.quarter}º Trimestre {lessonToDelete?.lessonYear ? `/ ${lessonToDelete.lessonYear}` : ''})? Todos os relatórios de presença associados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLesson}
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
