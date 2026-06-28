import { useMemo, useState } from "react";
import { Search, LifeBuoy, BookOpen, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArticleAccordion } from "@/components/help/ArticleView";
import { useHelp } from "@/hooks/useHelp";
import { MODULE_LABELS, type HelpModule, type HelpKind } from "@/lib/help/types";

export default function CentralAjuda() {
  const { articles, filter } = useHelp();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<HelpModule | "all">("all");
  const [kind, setKind] = useState<HelpKind | "all">("all");

  // Only offer module options that the user actually has content for.
  const availableModules = useMemo(() => {
    const set = new Set(articles.map((a) => a.module));
    return (Object.keys(MODULE_LABELS) as HelpModule[]).filter((m) => set.has(m));
  }, [articles]);

  const filtered = useMemo(
    () => filter({ query, module, kind }),
    [query, module, kind, articles],
  );

  const manuais = filtered.filter((a) => a.kind === "manual");
  const faqs = filtered.filter((a) => a.kind === "faq");
  const guias = filtered.filter((a) => a.kind === "guia");

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 md:pb-6">
      <header className="space-y-1.5">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold text-foreground">Central de Ajuda</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Manuais, FAQ e orientações — sempre adaptados ao seu acesso no sistema.
        </p>
      </header>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar na ajuda..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={module} onValueChange={(v) => setModule(v as HelpModule | "all")}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Módulo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os módulos</SelectItem>
                {availableModules.map((m) => (
                  <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={(v) => setKind(v as HelpKind | "all")}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="manual">Manuais</SelectItem>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="guia">Guias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="todos" className="w-full">
        <TabsList>
          <TabsTrigger value="todos">Todos ({filtered.length})</TabsTrigger>
          <TabsTrigger value="manuais">
            <BookOpen className="h-3.5 w-3.5 mr-1" /> Manuais ({manuais.length})
          </TabsTrigger>
          <TabsTrigger value="faq">
            <HelpCircle className="h-3.5 w-3.5 mr-1" /> FAQ ({faqs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Todo o conteúdo</CardTitle></CardHeader>
            <CardContent><ArticleAccordion articles={filtered} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="manuais" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Manuais por papel</CardTitle></CardHeader>
            <CardContent><ArticleAccordion articles={[...manuais, ...guias]} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="faq" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Perguntas frequentes</CardTitle></CardHeader>
            <CardContent><ArticleAccordion articles={faqs} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
