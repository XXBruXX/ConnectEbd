import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface PlaceholderContentProps {
  title: string;
  message?: string;
  icon?: React.ElementType;
}

export function PlaceholderContent({ title, message = "Esta seção está em desenvolvimento.", icon: Icon = Construction }: PlaceholderContentProps) {
  return (
    <Card className="w-full text-center border-dashed border-primary/50">
      <CardHeader>
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
         <Icon className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl text-primary">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{message}</p>
        <p className="text-sm text-muted-foreground mt-2">Volte em breve para novidades!</p>
      </CardContent>
    </Card>
  );
}
