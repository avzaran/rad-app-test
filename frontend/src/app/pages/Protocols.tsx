import { useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, FileText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { NewProtocolDialog } from "../components/NewProtocolDialog";
import { useProtocolsQuery } from "../hooks/useProtocols";
import { useProtocolTabsStore } from "../store/protocolTabsStore";

export function Protocols() {
  const navigate = useNavigate();
  const [isNewProtocolOpen, setIsNewProtocolOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: protocols = [], isLoading } = useProtocolsQuery();
  const openProtocol = useProtocolTabsStore((state) => state.openProtocol);

  const filteredProtocols = protocols.filter((protocol) =>
    protocol.patient.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Протоколы</h1>
          <p className="mt-2 text-muted-foreground">
            Управление протоколами исследований
          </p>
        </div>
        <Button onClick={() => setIsNewProtocolOpen(true)} size="lg">
          <Plus className="mr-2 h-5 w-5" />
          Новый протокол
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по пациентам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <Card className="p-6 text-sm text-muted-foreground">Загрузка протоколов...</Card>
        ) : null}

        {!isLoading && filteredProtocols.length === 0 ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="rounded-full bg-muted p-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Нет протоколов</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery
                  ? "Протоколы не найдены. Попробуйте изменить запрос."
                  : "Создайте первый протокол, нажав кнопку выше."}
              </p>
            </div>
          </Card>
        ) : !isLoading ? (
          filteredProtocols.map((protocol) => (
            <Card key={protocol.id} className="p-6 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{protocol.patient.name}</h3>
                    {protocol.status === "completed" ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                        Завершен
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                        Черновик
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {protocol.modality === "CT" && "КТ"}
                      {protocol.modality === "MRI" && "МРТ"}
                      {protocol.modality === "X_RAY" && "Рентген"}
                    </span>
                    {protocol.template ? (
                      <>
                        <span>•</span>
                        <span>{protocol.template.name}</span>
                      </>
                    ) : null}
                    <span>•</span>
                    <span>
                      {new Date(protocol.createdAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground">
                    <p className="line-clamp-2">{protocol.content}</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    openProtocol({
                      id: protocol.id,
                      patient: protocol.patient,
                    });
                    navigate(`/protocols/${protocol.id}`);
                  }}
                >
                  Открыть
                </Button>
              </div>
            </Card>
          ))
        ) : null}
      </div>

      <NewProtocolDialog open={isNewProtocolOpen} onOpenChange={setIsNewProtocolOpen} />
    </div>
  );
}
