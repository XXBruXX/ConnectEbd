
import { PlaceholderContent } from '@/components/shared/PlaceholderContent';
import { UserCircle } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="page-title flex items-center gap-2"><UserCircle className="h-8 w-8" />Meu Perfil</h1>
      <PlaceholderContent title="Perfil do Usuário" icon={UserCircle} message="Gerencie suas informações pessoais e preferências."/>
    </div>
  );
}
