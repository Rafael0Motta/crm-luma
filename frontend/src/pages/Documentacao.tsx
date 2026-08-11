import { useState, ReactNode } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  Zap,
  Repeat,
  CalendarClock,
  Tag,
  Receipt,
  UserCog,
  Settings,
  Bell,
  BookOpen,
  Lightbulb,
  Smartphone,
} from "lucide-react";
import { Card } from "../components/ui";

interface Section {
  id: string;
  title: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  content: JSX.Element;
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-ink-700">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-700">
            {i + 1}
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-2.5 rounded-lg bg-gold-200/40 px-4 py-3 text-sm text-ink-800">
      <Lightbulb size={16} className="mt-0.5 flex-shrink-0 text-gold-700" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-600">{children}</p>;
}

const SECTIONS: Section[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros passos",
    icon: BookOpen,
    content: (
      <div className="space-y-4">
        <P>
          O CRM Luma centraliza o atendimento via WhatsApp, o funil de vendas, as automações e a cobrança dos seus
          clientes em um único lugar. Este guia explica como usar cada área do sistema.
        </P>
        <P>Depois de fazer login, você tem acesso ao menu lateral com todas as áreas do sistema. As seções abaixo seguem a mesma ordem do menu.</P>
        <Tip>
          Se você é administrador, troque a senha padrão do usuário administrador assim que possível em{" "}
          <strong>Usuários</strong>.
        </Tip>
      </div>
    ),
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    content: (
      <div className="space-y-4">
        <P>A tela inicial mostra um resumo rápido da operação:</P>
        <Steps
          items={[
            "Conversas abertas e pendentes no momento.",
            "Quantos clientes novos entraram no mês.",
            "Taxa de resposta da equipe às conversas do mês.",
            "Distribuição de clientes por etapa do funil de vendas.",
            "Lembretes de cobrança que falharam ao enviar no mês (vale a pena checar se esse número não for zero).",
          ]}
        />
      </div>
    ),
  },
  {
    id: "conversas",
    title: "Conversas (Inbox)",
    icon: MessageSquare,
    content: (
      <div className="space-y-5">
        <P>
          É aqui que o atendimento via WhatsApp acontece. A lista à esquerda mostra todas as conversas, com o nome do
          cliente, a prévia da última mensagem e quantas mensagens não lidas existem. Novas mensagens aparecem
          automaticamente na tela, sem precisar atualizar a página.
        </P>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Encontrar uma conversa</p>
          <Steps
            items={[
              'Use os filtros "Todas / Abertas / Pendentes / Resolvidas" no topo da lista.',
              "Digite um nome ou telefone no campo de busca para filtrar rapidamente.",
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Iniciar uma conversa nova</p>
          <Steps
            items={[
              'Clique em "Nova" no topo da lista de conversas.',
              "Informe o telefone do lead (com DDD e código do país, ex: 5511999999999) e, opcionalmente, o nome.",
              "Se já existir um cliente com esse telefone, a conversa é aberta com ele. Se não existir, um novo cliente é criado automaticamente.",
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Enviar mensagens</p>
          <Steps
            items={[
              "Digite a mensagem no campo inferior e pressione Enter (ou clique no botão de enviar).",
              "Para enviar uma imagem, áudio ou documento, clique no clipe de anexo, escolha o arquivo e, se quiser, escreva uma legenda antes de enviar.",
              "Também dá para colar uma imagem copiada (Ctrl+V) direto no campo de mensagem, ou arrastar um arquivo do computador e soltar em qualquer lugar da conversa.",
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Ver e baixar arquivos recebidos</p>
          <Steps
            items={[
              "Clique em uma imagem ou vídeo recebido para abri-lo em tela cheia.",
              'Passe o mouse sobre uma imagem, vídeo, áudio ou documento e clique no ícone de download para salvar o arquivo no computador.',
            ]}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Ferramentas no topo da conversa</p>
          <Steps
            items={[
              '"IA ativa/inativa": liga ou desliga a inteligência artificial só para aquela conversa específica. Use quando um atendente for assumir manualmente e não quiser que a IA responda automaticamente.',
              '"Agendar": programa uma mensagem para ser enviada a esse cliente em uma data e hora futura, sem sair da conversa.',
              '"Resolver": marca a conversa como concluída.',
              "Seletor de etapa do funil: muda a etapa do funil de vendas do cliente direto pela conversa.",
              "Seletor de atendente: atribui a conversa a um atendente da equipe.",
            ]}
          />
        </div>

        <Tip>
          O sino no canto superior direito da tela avisa quando um lead está sem resposta há mais de 24 horas.
          Clique nele para ver a lista e ir direto para a conversa.
        </Tip>
      </div>
    ),
  },
  {
    id: "funil",
    title: "Funil de vendas",
    icon: Kanban,
    content: (
      <div className="space-y-4">
        <P>Visão em quadro (kanban) dos clientes por etapa do funil de vendas.</P>
        <Steps
          items={[
            "Arraste o card de um cliente entre as colunas para mudar sua etapa.",
            'Clique em "Gerenciar etapas" para criar, renomear ou remover etapas do funil conforme o processo de vendas da empresa.',
          ]}
        />
      </div>
    ),
  },
  {
    id: "clientes",
    title: "Clientes",
    icon: Users,
    content: (
      <div className="space-y-4">
        <P>Cadastro completo dos clientes, com serviços vinculados e etiquetas.</P>
        <Steps
          items={[
            'Clique em "Novo cliente" para cadastrar manualmente (nome, telefone, e-mail, documento, etapa do funil, atendente responsável).',
            "Clique em um cliente na lista para ver a ficha completa, editar os dados, adicionar/remover etiquetas e vincular serviços.",
            'Dentro da ficha do cliente, use "Novo vínculo" para associar um serviço do catálogo, com valor, dia de vencimento e data de pagamento.',
            "Use o campo de busca e os filtros por etapa/etiqueta/atendente no topo da lista para encontrar clientes rapidamente. Também é possível selecionar vários clientes de uma vez para excluir, etiquetar ou mover de etapa em lote, e importar/exportar a lista em CSV.",
          ]}
        />
      </div>
    ),
  },
  {
    id: "automacoes",
    title: "Automações",
    icon: Zap,
    content: (
      <div className="space-y-4">
        <P>Regras que executam ações automaticamente quando algo acontece — sem precisar programar nada.</P>
        <Steps
          items={[
            'Clique em "Nova automação" e escolha o gatilho: nova conversa, mensagem recebida, cliente muda de etapa do funil ou etiqueta aplicada.',
            "Adicione condições (opcional) para restringir quando a automação deve rodar — por exemplo, só disparar se a mensagem contiver uma palavra específica.",
            "Adicione uma ou mais ações: enviar mensagem, aplicar etiqueta, mover etapa do funil, atribuir a um atendente, acionar a IA ou notificar a equipe internamente.",
            'Use o botão de "testar" (ícone de play) em uma automação existente para simular a execução em um cliente escolhido antes de confiar 100% nela.',
            "Use o interruptor para ativar/desativar uma automação sem precisar excluí-la.",
          ]}
        />
      </div>
    ),
  },
  {
    id: "followups",
    title: "Follow-ups",
    icon: Repeat,
    content: (
      <div className="space-y-4">
        <P>Sequências automáticas de mensagens para reengajar clientes que pararam de responder ou ficaram parados no funil.</P>
        <Steps
          items={[
            "Escolha o gatilho: sem resposta do cliente há X horas, parado em uma etapa do funil há X dias, ou após receber uma etiqueta.",
            "Monte a sequência de mensagens, definindo o intervalo de espera entre cada uma.",
            'Ative "parar sequência se o cliente responder" para interromper automaticamente o follow-up assim que o lead responder.',
            'Use o ícone de histórico para ver quais clientes já passaram por aquele follow-up e em que passo estão.',
            'Precisa segurar o follow-up de um lead específico sem desativar a automação inteira? No histórico de execuções, clique no ícone de pausa ao lado do lead — ele para de receber as próximas mensagens da sequência até você clicar em retomar.',
          ]}
        />
        <Tip>Follow-ups rodam automaticamente em segundo plano a cada poucos minutos — não é preciso disparar manualmente.</Tip>
      </div>
    ),
  },
  {
    id: "agendadas",
    title: "Mensagens agendadas",
    icon: CalendarClock,
    content: (
      <div className="space-y-4">
        <P>Envios avulsos ou em massa programados para uma data e hora específica.</P>
        <Steps
          items={[
            'Clique em "Nova mensagem", escreva o texto e escolha a data/hora do envio.',
            "Escolha o destinatário: um cliente específico, todos os clientes com uma etiqueta, todos em uma etapa do funil, ou todos os clientes.",
            'Use o botão de envio (ícone de avião) para disparar uma mensagem pendente imediatamente, sem esperar a data agendada.',
          ]}
        />
        <Tip>Mensagens agendadas enviadas aparecem no histórico da conversa de cada cliente, junto com as demais mensagens.</Tip>
      </div>
    ),
  },
  {
    id: "etiquetas",
    title: "Etiquetas",
    icon: Tag,
    content: (
      <div className="space-y-4">
        <P>Etiquetas coloridas para organizar e segmentar clientes (ex: VIP, Inadimplente, Interessado).</P>
        <Steps items={["Crie etiquetas com nome e cor.", "Aplique-as aos clientes pela ficha do cliente ou direto pela conversa."]} />
      </div>
    ),
  },
  {
    id: "cobranca",
    title: "Cobrança",
    icon: Receipt,
    content: (
      <div className="space-y-4">
        <P>Lembretes automáticos de vencimento de serviços vinculados aos clientes, enviados por WhatsApp.</P>
        <Steps
          items={[
            'Crie um lembrete "padrão para todo cliente vinculado" a um serviço — ele passa a valer automaticamente para qualquer cliente atual ou futuro que tiver aquele serviço.',
            "Ou vincule o lembrete a um serviço específico de um cliente (um vínculo já existente), ou direto a um cliente sem serviço (informando o dia do vencimento manualmente).",
            "Defina quantos dias antes ou depois do vencimento o lembrete deve ser disparado.",
            "Escreva a mensagem usando variáveis como {{nome}}, {{servico}}, {{valor}} e {{dia_vencimento}} — elas são substituídas automaticamente.",
            'Use "enviar teste" para conferir como a mensagem fica antes de deixar o lembrete ativo.',
            "Consulte o histórico de envios de cada lembrete pelo ícone de relógio.",
            "Também é possível criar um lembrete de cobrança direto pelo chat de um lead, pelo botão \"Criar cobrança\" no cabeçalho da conversa.",
          ]}
        />
      </div>
    ),
  },
  {
    id: "usuarios",
    title: "Usuários",
    icon: UserCog,
    adminOnly: true,
    content: (
      <div className="space-y-4">
        <P>Área restrita a administradores para gerenciar quem tem acesso ao sistema.</P>
        <Steps
          items={[
            'Clique em "Novo usuário" para cadastrar um atendente ou outro administrador.',
            "Use o interruptor para ativar/desativar o acesso de um usuário sem excluir a conta.",
            "Edite nome, e-mail, papel (administrador/atendente) ou redefina a senha pelo ícone de lápis.",
          ]}
        />
      </div>
    ),
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    adminOnly: true,
    content: (
      <div className="space-y-5">
        <P>Área restrita a administradores com as integrações do sistema.</P>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">WhatsApp (Evolution API)</p>
          <Steps
            items={[
              "Veja o status da conexão da instância padrão do WhatsApp.",
              "Se estiver desconectada, gere o QR Code e escaneie com o WhatsApp que vai atender pelo sistema.",
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Instâncias por módulo (múltiplos números)</p>
          <P>
            Por padrão, tudo (atendimento, follow-ups e cobrança) sai pelo mesmo número de WhatsApp. Se quiser usar
            números diferentes para cada finalidade, cadastre instâncias adicionais aqui.
          </P>
          <div className="mt-3">
            <Steps
              items={[
                'Clique em "Nova instância" e informe um nome de identificação, o nome da instância cadastrada na Evolution API e qual módulo ela vai atender: Atendimento, Follow-ups ou Cobrança.',
                "URL e chave de API são opcionais — deixe em branco para usar as credenciais padrão do sistema, ou preencha se essa instância estiver em outra Evolution API.",
                "Só pode haver uma instância ativa por módulo. Para trocar o número de um módulo, desative a instância atual antes de ativar a nova.",
                "Use o ícone de QR Code em cada instância para ver o status da conexão e conectar o número, do mesmo jeito que na instância padrão.",
              ]}
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">Inteligência Artificial</p>
          <Steps
            items={[
              "Cadastre o provedor de IA (OpenAI, Anthropic/Claude ou outro compatível), o modelo e a chave de API.",
              "Escreva o prompt de sistema — as instruções que definem como a IA deve se comportar e responder pelos clientes.",
              "Ajuste temperatura (criatividade das respostas) e o limite de tokens por resposta.",
              'Só uma configuração de IA fica "ativa" por vez — é ela que as automações usam ao acionar a IA.',
            ]}
          />
        </div>
        <Tip>A chave de API fica criptografada no banco de dados e nunca é exibida em texto puro depois de salva.</Tip>
      </div>
    ),
  },
  {
    id: "notificacoes",
    title: "Notificações",
    icon: Bell,
    content: (
      <div className="space-y-4">
        <P>O sino no topo da tela avisa sobre leads sem resposta há mais de 24 horas — conversas em que sua equipe enviou a última mensagem e o cliente ainda não respondeu.</P>
        <Steps items={["Clique no sino para ver a lista.", "Clique em um lead da lista para ir direto para a conversa dele."]} />
      </div>
    ),
  },
  {
    id: "app-instalavel",
    title: "Instalar como aplicativo",
    icon: Smartphone,
    content: (
      <div className="space-y-4">
        <P>
          O CRM pode ser instalado como um aplicativo, no celular ou no computador, ficando com ícone próprio e
          abrindo em tela cheia — sem precisar abrir o navegador toda vez.
        </P>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">No celular (Android)</p>
          <Steps items={['Abra o CRM pelo Chrome e toque no menu (⋮) no canto superior direito.', 'Toque em "Instalar aplicativo" ou "Adicionar à tela inicial".']} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">No iPhone (Safari)</p>
          <Steps items={['Toque no ícone de compartilhar (quadrado com seta para cima).', 'Toque em "Adicionar à Tela de Início".']} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-900">No computador (Chrome/Edge)</p>
          <Steps items={["Clique no ícone de instalação que aparece do lado direito da barra de endereço.", "O sistema abre então em sua própria janela, separada do navegador."]} />
        </div>
        <Tip>As mensagens continuam chegando em tempo real depois de instalado, do mesmo jeito que no navegador.</Tip>
      </div>
    ),
  },
];

export function Documentacao() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  function scrollTo(id: string) {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="border-b border-ink-100 bg-white px-8 py-5">
        <h1 className="text-xl font-semibold text-ink-950">Documentação</h1>
        <p className="mt-0.5 text-sm text-ink-500">Guia passo a passo de como usar o CRM Luma Benefícios</p>
      </div>

      <div className="flex gap-8 p-8">
        <nav className="sticky top-8 hidden w-56 flex-shrink-0 self-start lg:block">
          <ul className="space-y-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollTo(section.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeId === section.id ? "bg-ink-100 font-medium text-ink-900" : "text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                  }`}
                >
                  <section.icon size={16} className="flex-shrink-0" />
                  {section.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-2xl flex-1 space-y-6">
          {SECTIONS.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-8 p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                  <section.icon size={16} />
                </div>
                <h2 className="text-base font-semibold text-ink-950">{section.title}</h2>
                {section.adminOnly && (
                  <span className="rounded-full bg-gold-200 px-2 py-0.5 text-[11px] font-medium text-gold-700">
                    Somente administradores
                  </span>
                )}
              </div>
              {section.content}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
