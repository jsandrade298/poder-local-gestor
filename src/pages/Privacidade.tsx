import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MarcaIcone, MarcaPalavra } from "@/components/marca/Marca";
import { useTema } from "@/lib/tema";

/**
 * Política de Privacidade (pública, sem login). Exigida pelo Google para a
 * integração com o Google Agenda e boa prática pela LGPD.
 * Ao mudar o conteúdo, atualize VIGENCIA.
 */

const VIGENCIA = "24 de novembro de 2026";
/** E-mail para assuntos de privacidade. Vazio = orienta a falar com o gabinete. */
const EMAIL_CONTATO = "";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg md:text-xl font-bold tracking-tight">{titulo}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

export default function Privacidade() {
  const { perfil } = useTema();
  return (
    <div data-perfil={perfil} className="min-h-screen bg-background text-foreground">
      <header className="border-b" style={{ background: "var(--marca-fundo-escuro)" }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link to="/" aria-label="Jorgeus — início" className="flex items-center gap-2.5">
            <MarcaIcone perfil={perfil} className="h-8 w-8" />
            <MarcaPalavra perfil={perfil} modo="escuro" className="h-[15px]" />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/75 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 md:py-14 space-y-10">
        <div className="space-y-2">
          <p className="texto-etiqueta text-primary">Privacidade</p>
          <h1 className="titulo-compacto text-3xl md:text-4xl font-extrabold tracking-tight">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Vigente desde {VIGENCIA}.</p>
        </div>

        <Secao titulo="1. Quem somos e qual é o nosso papel">
          <p>
            O <strong>Jorgeus</strong> é uma plataforma de gestão para gabinetes parlamentares: demandas, munícipes, agenda,
            quadros de trabalho e análises. Cada gabinete trabalha em um espaço isolado.
          </p>
          <p>
            Pela Lei Geral de Proteção de Dados (Lei 13.709/2018), <strong>o gabinete é o controlador</strong> dos dados que
            cadastra (por exemplo, munícipes e demandas) e decide como usá-los. <strong>O Jorgeus atua como operador</strong>:
            guarda e processa esses dados em nome do gabinete, só para prestar o serviço.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados tratamos">
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Da sua conta:</strong> nome, e-mail, telefone e cargo, cadastrados pelo administrador do gabinete.</li>
            <li><strong>Do trabalho do gabinete:</strong> munícipes, demandas, atividades, anexos, agendas, cartões e comentários que a equipe registra.</li>
            <li><strong>Técnicos:</strong> registros de acesso e de uso necessários para segurança e funcionamento (data, hora, ações realizadas).</li>
            <li><strong>Do Google Agenda, se você conectar:</strong> a lista das suas agendas, os eventos (título, data, horário, local, descrição e convidados) e o e-mail da conta Google conectada.</li>
          </ul>
        </Secao>

        <Secao titulo="3. Para que usamos">
          <ul className="list-disc pl-5 space-y-2">
            <li>Permitir o atendimento e o acompanhamento das demandas do gabinete.</li>
            <li>Organizar a agenda e o trabalho da equipe, com avisos de prazo e menções.</li>
            <li>Gerar números e análises para o próprio gabinete.</li>
            <li>Manter a plataforma segura e corrigir problemas.</li>
          </ul>
          <p>Não vendemos dados, não os usamos para publicidade e não os compartilhamos com outros gabinetes.</p>
        </Secao>

        <Secao titulo="4. Google Agenda">
          <p>
            A conexão com o Google Agenda é opcional. Ao conectar, você autoriza o Jorgeus a <strong>ver suas agendas e
            ver, criar, editar e excluir eventos</strong>, sempre por ação de alguém no Jorgeus (por exemplo, marcar um
            compromisso). Pedimos só o necessário para isso.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Os dados do Google Agenda são usados <strong>apenas para mostrar e gerenciar a agenda dentro do Jorgeus</strong>.</li>
            <li>Não são vendidos, não são usados para publicidade, não são lidos por pessoas (salvo com sua permissão, por obrigação legal ou para segurança) e <strong>não são usados para treinar modelos de inteligência artificial</strong>.</li>
            <li>As credenciais de acesso ficam guardadas de forma protegida no servidor e nunca são exibidas nas telas.</li>
            <li>
              Você pode desconectar a qualquer momento pelo Jorgeus ou em{" "}
              <a className="text-primary underline underline-offset-2" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.
            </li>
          </ul>
          <p>
            O uso e a transferência, para qualquer outro aplicativo, de informações recebidas das APIs do Google seguem a{" "}
            <a className="text-primary underline underline-offset-2" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
              Política de Dados do Usuário dos Serviços de API do Google
            </a>, incluindo os requisitos de Uso Limitado.
          </p>
        </Secao>

        <Secao titulo="5. Com quem os dados podem ser compartilhados">
          <p>Somente com serviços necessários para o Jorgeus funcionar, sob contrato e com proteção adequada:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Supabase:</strong> banco de dados, arquivos e autenticação.</li>
            <li><strong>Netlify:</strong> hospedagem do site.</li>
            <li><strong>Google:</strong> apenas quando você conecta o Google Agenda.</li>
            <li><strong>OpenAI:</strong> apenas o conteúdo que você mesmo envia ao Assessor IA, para gerar a resposta. Os dados do Google Agenda não são enviados ao Assessor IA.</li>
          </ul>
          <p>Também podemos compartilhar dados quando exigido por lei ou por ordem de autoridade competente.</p>
        </Secao>

        <Secao titulo="6. Segurança">
          <p>
            Os dados de cada gabinete ficam isolados dos demais. O acesso é feito por convite do administrador, e cada pessoa
            vê e altera apenas o que a sua função permite. A comunicação é criptografada (HTTPS).
          </p>
        </Secao>

        <Secao titulo="7. Por quanto tempo guardamos">
          <p>
            Enquanto o gabinete usar o Jorgeus. Demandas excluídas ficam 30 dias na lixeira, para recuperação, e depois são
            apagadas. Ao fim do contrato, ou a pedido do gabinete, os dados são excluídos, salvo o que a lei obrigar a manter.
            Ao desconectar o Google Agenda, as credenciais de acesso são apagadas.
          </p>
        </Secao>

        <Secao titulo="8. Seus direitos">
          <p>
            Pela LGPD, você pode pedir confirmação do tratamento, acesso, correção, anonimização ou exclusão de dados,
            portabilidade, informações sobre compartilhamento e a revogação do consentimento. Como o gabinete é o controlador,
            o pedido costuma ser feito a ele; nós o apoiamos no atendimento.
          </p>
        </Secao>

        <Secao titulo="9. Contato">
          {EMAIL_CONTATO ? (
            <p>
              Para assuntos de privacidade, escreva para{" "}
              <a className="text-primary underline underline-offset-2" href={`mailto:${EMAIL_CONTATO}`}>{EMAIL_CONTATO}</a>.
            </p>
          ) : (
            <p>Para assuntos de privacidade, fale com o administrador do seu gabinete, que encaminha o pedido para nós.</p>
          )}
          <p>Esta política pode ser atualizada; a data de vigência no topo sempre mostra a versão atual.</p>
        </Secao>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-3xl px-5 py-6 text-xs text-muted-foreground">© {new Date().getFullYear()} Jorgeus · Gestão e Inteligência Parlamentar</div>
      </footer>
    </div>
  );
}
