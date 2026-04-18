const TermsOfService = () => {
  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Termos de Serviço</h1>
      <p className="text-muted-foreground mb-4">Última atualização: 18 de abril de 2026</p>

      <section className="space-y-4 text-sm leading-relaxed">
        <h2 className="text-xl font-semibold mt-6">1. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta ou utilizar a plataforma Porta do Corretor, você concorda integralmente
          com estes Termos de Serviço e com a nossa{" "}
          <a href="/privacidade" className="text-primary underline">Política de Privacidade</a>.
          Se você não concorda, não utilize a plataforma.
        </p>

        <h2 className="text-xl font-semibold mt-6">2. Descrição do serviço</h2>
        <p>
          O Porta do Corretor é uma plataforma SaaS voltada a corretores e imobiliárias, oferecendo
          gestão de imóveis, CRM de leads, automações de WhatsApp, integrações com portais e Meta Ads,
          sites white-label e ferramentas de inteligência artificial.
        </p>

        <h2 className="text-xl font-semibold mt-6">3. Cadastro e conta</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Você deve fornecer informações verdadeiras, completas e atualizadas.</li>
          <li>É responsável por manter a confidencialidade das credenciais de acesso.</li>
          <li>Atividades realizadas em sua conta são de sua responsabilidade.</li>
          <li>Reservamo-nos o direito de suspender contas com indícios de fraude ou uso indevido.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">4. Planos, pagamentos e trial</h2>
        <p>
          Oferecemos planos gratuitos, períodos de avaliação (trial) e planos pagos. Os pagamentos são
          processados por provedores terceirizados. Em caso de inadimplência, o acesso a recursos pagos
          pode ser suspenso até a regularização.
        </p>

        <h2 className="text-xl font-semibold mt-6">5. Uso aceitável</h2>
        <p>Você concorda em não:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Utilizar a plataforma para envio de spam, mensagens não solicitadas ou conteúdo ilegal.</li>
          <li>Violar a LGPD ou outras leis aplicáveis ao tratar dados de leads e clientes.</li>
          <li>Tentar acessar áreas restritas, contornar limites técnicos ou comprometer a segurança.</li>
          <li>Revender, sublicenciar ou explorar comercialmente a plataforma sem autorização.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-6">6. Conteúdo do usuário</h2>
        <p>
          Você mantém a titularidade dos dados, imagens, textos e demais conteúdos que cadastrar na
          plataforma. Concede à Porta do Corretor licença não exclusiva para hospedar, processar e
          exibir esse conteúdo conforme necessário à prestação do serviço.
        </p>

        <h2 className="text-xl font-semibold mt-6">7. Integrações com terceiros</h2>
        <p>
          A plataforma integra-se a serviços de terceiros (Meta, Google, WhatsApp, portais imobiliários,
          provedores de IA, entre outros). O uso dessas integrações está sujeito aos termos dos respectivos
          provedores. Não nos responsabilizamos por indisponibilidade ou alterações nas APIs externas.
        </p>

        <h2 className="text-xl font-semibold mt-6">8. Inteligência Artificial</h2>
        <p>
          Recursos de IA (geração de textos, qualificação de leads, atendimento automatizado) podem
          produzir resultados imprecisos. Recomendamos sempre revisar o conteúdo antes de publicá-lo
          ou enviá-lo a clientes. O uso da IA está sujeito a limites por plano e cotas de créditos.
        </p>

        <h2 className="text-xl font-semibold mt-6">9. Disponibilidade e suporte</h2>
        <p>
          Empenhamo-nos em manter a plataforma disponível, mas não garantimos operação ininterrupta.
          Manutenções programadas e eventuais incidentes podem afetar a disponibilidade. O suporte é
          oferecido nos canais oficiais durante o horário comercial.
        </p>

        <h2 className="text-xl font-semibold mt-6">10. Limitação de responsabilidade</h2>
        <p>
          A Porta do Corretor não se responsabiliza por danos indiretos, lucros cessantes ou perda de
          dados decorrentes do uso da plataforma. Nossa responsabilidade total fica limitada ao valor
          efetivamente pago pelo cliente nos 12 meses anteriores ao evento que originou a reclamação.
        </p>

        <h2 className="text-xl font-semibold mt-6">11. Encerramento</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento nas configurações. Podemos suspender ou
          encerrar contas que violem estes termos, com ou sem aviso prévio. Após o encerramento, os
          dados são removidos conforme a Política de Privacidade.
        </p>

        <h2 className="text-xl font-semibold mt-6">12. Alterações dos termos</h2>
        <p>
          Estes Termos podem ser atualizados periodicamente. Alterações relevantes serão comunicadas
          pelo sistema ou por e-mail. O uso continuado após a notificação caracteriza aceitação.
        </p>

        <h2 className="text-xl font-semibold mt-6">13. Lei aplicável e foro</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
          do domicílio do contratante para dirimir eventuais controvérsias.
        </p>

        <h2 className="text-xl font-semibold mt-6">14. Contato</h2>
        <p>
          Dúvidas sobre estes Termos:{" "}
          <a href="mailto:contato@portadocorretor.com.br" className="text-primary underline">
            contato@portadocorretor.com.br
          </a>
        </p>
      </section>
    </main>
  );
};

export default TermsOfService;
