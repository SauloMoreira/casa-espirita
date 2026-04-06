import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, BookOpen, Lightbulb, MessageSquare, BarChart3, Settings } from "lucide-react";
import QueixasTratamentos from "@/components/central-ia/QueixasTratamentos";
import BibliotecaDoutrinaria from "@/components/central-ia/BibliotecaDoutrinaria";
import SugestoesIA from "@/components/central-ia/SugestoesIA";
import FeedbackAprendizado from "@/components/central-ia/FeedbackAprendizado";
import IndicadoresAssertividade from "@/components/central-ia/IndicadoresAssertividade";
import ConfiguracoesIA from "@/components/central-ia/ConfiguracoesIA";

export default function CentralIA() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          Central de Apoio e Calibração da IA
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie a base de conhecimento e calibre a assertividade do assistente de IA
        </p>
      </div>

      <Tabs defaultValue="queixas" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="queixas" className="flex items-center gap-1.5 text-xs py-2.5">
            <Brain className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Queixas</span>
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="flex items-center gap-1.5 text-xs py-2.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Biblioteca</span>
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="flex items-center gap-1.5 text-xs py-2.5">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sugestões</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-1.5 text-xs py-2.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="flex items-center gap-1.5 text-xs py-2.5">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Indicadores</span>
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="flex items-center gap-1.5 text-xs py-2.5">
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queixas" className="mt-6">
          <QueixasTratamentos />
        </TabsContent>
        <TabsContent value="biblioteca" className="mt-6">
          <BibliotecaDoutrinaria />
        </TabsContent>
        <TabsContent value="sugestoes" className="mt-6">
          <SugestoesIA />
        </TabsContent>
        <TabsContent value="feedback" className="mt-6">
          <FeedbackAprendizado />
        </TabsContent>
        <TabsContent value="indicadores" className="mt-6">
          <IndicadoresAssertividade />
        </TabsContent>
        <TabsContent value="configuracoes" className="mt-6">
          <ConfiguracoesIA />
        </TabsContent>
      </Tabs>
    </div>
  );
}
