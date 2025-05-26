
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Building, School, UserPlus, Crown, Edit3, Users as UsersIcon } from 'lucide-react'; // Added Crown and Edit3
import { useRouter } from 'next/navigation';
import type { DocumentData } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useFirebase } from '@/providers/FirebaseProvider';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { cn } from "@/lib/utils"; // Ensure cn is imported

const registrationStepsOriginal = [
  {
    id: 1,
    title: "Igreja Sede", // Changed from "Cadastro da Sede"
    description: "Visualizar ou editar os dados da sua igreja principal.", // Updated description
    icon: Edit3, // Changed to Edit3 to reflect edit action
    action: "Editar dados", // Kept action text
    href: '/register/church-info',
    iconBg: 'bg-primary', // Example: blue (this was hsl(var(--primary)) in the image)
  },
  {
    id: 2,
    title: "Congregações", // Changed from "Cadastro de Congregações"
    description: "Gerenciar congregações e filiais vinculadas.",
    icon: UsersIcon, // Using UsersIcon as an example for congregações
    action: "Gerenciar Congregações", // Updated action text
    href: '/register/congregation-form',
    iconBg: 'bg-secondary', // Example: purple (this was hsl(var(--secondary)) in the image)
  },
  {
    id: 3,
    title: "Cadastro de Classes",
    description: "Crie e gerencie as classes para cada igreja ou congregação.",
    icon: School,
    action: "Criar Classe",
    href: '/register/class-form',
    iconBg: 'bg-green-500', // Example: Green
  },
  {
    id: 4,
    title: "Cadastro de Alunos e Professores", // Changed from "Cadastro de Pessoas"
    description: "Registre alunos, professores e outros membros.",
    icon: UserPlus,
    action: "Adicionar Pessoa",
    href: '/register/person-form',
    iconBg: 'bg-orange-500', // Example: Orange
  },
];

export default function RegistrationPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { db } = useFirebase(); // db might not be directly used here, but good to have if needed later
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (!authLoading) {
        setLoadingPage(false);
    }
  }, [authLoading]);


  const handleButtonClick = (href: string | undefined) => {
    if (href) {
      router.push(href);
    }
  };

  if (authLoading || loadingPage) {
    return <LoadingSpinner fullScreen />;
  }

  // If not loading and no user, AuthWrapper should handle redirection
  if (!user) {
    return null; // Or a specific message, but AuthWrapper typically handles this
  }

  const registrationSteps = [...registrationStepsOriginal];

  return (
    <div className="space-y-8 w-full max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <div className="inline-block p-3 bg-primary rounded-lg mb-4"> {/* Blue background for Crown */}
          <Crown className="h-10 w-10 text-primary-foreground" /> {/* White icon */}
        </div>
        <h1 className="text-4xl font-bold text-foreground">Cadastros</h1> {/* Changed from "Cadastro Progressivo" */}
        <p className="text-muted-foreground text-lg mt-2">
          Gerenciar todos os cadastros do sistema
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {registrationSteps.map((step) => (
          <Card
            key={step.id}
            className="bg-card text-card-foreground rounded-xl shadow-xl flex flex-col overflow-hidden hover:scale-[1.02] transition-transform duration-200 ease-in-out"
          >
            <CardHeader className="flex flex-row items-start gap-4 p-5">
              <div className={cn("p-3 rounded-lg shrink-0", step.iconBg)}> {/* Icon background */}
                <step.icon className="h-7 w-7 text-white" /> {/* Icon color set to white */}
              </div>
              <div className="flex-grow">
                <CardTitle className="text-xl font-semibold text-foreground">{step.title}</CardTitle>
                <CardDescription className="text-muted-foreground mt-1">{step.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5 mt-auto"> {/* Pushes button to the bottom */}
              <Button
                className="w-full py-3 text-md font-semibold bg-background/30 hover:bg-background/50 text-foreground"
                variant="outline"
                onClick={() => handleButtonClick(step.href)}
              >
                {step.action}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-12 bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle className="text-foreground">Próximos Passos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Complete esses cadastros para gerenciar frequências,
            agendar aulas, visualizar relatórios detalhados e muito mais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
