import { FileText, FileStack, Users, TrendingUp } from "lucide-react";
import { Card } from "../components/ui/card";
import { usePatientsQuery } from "../hooks/usePatients";
import { useTemplatesQuery } from "../hooks/useTemplates";
import { useProtocolsQuery } from "../hooks/useProtocols";

export function Dashboard() {
  const { data: protocols = [], isLoading: protocolsLoading } = useProtocolsQuery();
  const { data: templates = [], isLoading: templatesLoading } = useTemplatesQuery();
  const { data: patients = [], isLoading: patientsLoading } = usePatientsQuery();

  const isLoading = protocolsLoading || templatesLoading || patientsLoading;

  const completedProtocols = protocols.filter((p) => p.status === "completed").length;
  const draftProtocols = protocols.filter((p) => p.status === "draft").length;

  const stats = [
    {
      label: "Всего протоколов",
      value: protocols.length,
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Завершенные",
      value: completedProtocols,
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Черновики",
      value: draftProtocols,
      icon: FileText,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      label: "Пациентов",
      value: patients.length,
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Шаблонов",
      value: templates.length,
      icon: FileStack,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
    },
  ];

  const recentProtocols = protocols
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold">Дашборд</h1>
        <p className="mt-2 text-muted-foreground">
          Добро пожаловать в RadAssist PRO
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {isLoading ? (
          <Card className="col-span-full p-6 text-sm text-muted-foreground">
            Загрузка данных...
          </Card>
        ) : null}
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-6">
              <div className="flex items-center gap-4">
                <div className={`rounded-lg p-3 ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent Protocols */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Последние протоколы</h2>
        <Card>
          <div className="divide-y divide-border">
            {recentProtocols.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Нет протоколов
              </div>
            ) : (
              recentProtocols.map((protocol) => (
                <div
                  key={protocol.id}
                  className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{protocol.patient.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {protocol.modality === "CT" && "КТ"}
                      {protocol.modality === "MRI" && "МРТ"}
                      {protocol.modality === "X_RAY" && "Рентген"}
                      {protocol.template && ` • ${protocol.template.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(protocol.updatedAt).toLocaleDateString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(protocol.updatedAt).toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div>
                      {protocol.status === "completed" ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                          Завершен
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-950 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                          Черновик
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
