
import { PlaceholderContent } from '@/components/shared/PlaceholderContent';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="page-title flex items-center gap-2"><Settings className="h-8 w-8" />Configurações</h1>
      <PlaceholderContent title="Configurações do Aplicativo" icon={Settings} message="Ajuste as configurações gerais do Controle EBD."/>
    </div>
  );
}
