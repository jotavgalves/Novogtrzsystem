# Plano Geral do GTRZ System

## 1. Visão do produto

O GTRZ System será um PDV desktop para Windows, operado em um único computador e totalmente funcional sem internet após a instalação. O sistema administrará operações de eventos independentes, preservando histórico, rastreabilidade financeira, estoque e auditoria.

O aplicativo deverá priorizar:

1. rapidez durante a operação do evento;
2. baixa possibilidade de erro humano;
3. consistência entre venda, estoque, voucher e caixa;
4. recuperação segura de dados;
5. rastreabilidade de qualquer alteração;
6. interface direta, escura e de fácil leitura.

## 2. Separação por evento

Todos os dados operacionais serão vinculados a um evento.

Cada evento possuirá, de forma independente:

- status e período;
- mesas;
- vendas;
- estoque disponível para o evento;
- movimentações de estoque;
- vouchers;
- lotes e vendas de ingressos;
- despesas;
- caixa e movimentações financeiras;
- auditoria;
- relatórios;
- configuração operacional específica.

O catálogo de produtos poderá ser copiado de outro evento para acelerar o cadastro, mas quantidades, custos, preços e movimentações pertencerão ao evento atual.

### Estados sugeridos do evento

- Planejamento
- Ativo
- Encerrado
- Arquivado

Um evento encerrado ficará bloqueado para novas vendas por padrão. A Produção poderá reabri-lo mediante confirmação e registro em auditoria.

## 3. Perfis de acesso

O sistema terá somente dois perfis.

### 3.1 Produção

Possui direitos administrativos completos:

- cria, edita, encerra, reabre e arquiva eventos;
- administra produtos, estoque e combos;
- administra mesas e balcão;
- administra vouchers;
- visualiza e opera caixa e despesas;
- administra ingressos;
- consulta auditoria e relatórios;
- altera configurações;
- executa e importa backups;
- autoriza ações protegidas do perfil Caixa.

### 3.2 Caixa

Perfil operacional restrito:

- acessa mesas e Balcão;
- realiza vendas dentro das mesas;
- aplica voucher válido à venda;
- consulta estoque operacional, sem custo, margem ou lucro;
- não acessa ingressos;
- não acessa despesas, caixa administrativo, auditoria, configurações ou relatórios gerenciais;
- não cadastra nem altera produtos;
- precisa da senha da Produção para editar ou cancelar vendas e para outras ações protegidas.

A alternância de Caixa para Produção exigirá senha. A senha inicial será `121225`, porém deverá ser alterável nas configurações e armazenada apenas como hash seguro.

## 4. Módulo de estoque e produtos

### 4.1 Cadastro de produto

Cada produto terá, no mínimo:

- nome;
- categoria;
- descrição opcional;
- unidade de medida;
- quantidade atual;
- limite de estoque baixo;
- preço de custo;
- preço de venda;
- lucro bruto unitário;
- margem percentual sobre a venda;
- status ativo ou arquivado;
- data de criação e atualização.

Categorias iniciais:

- Comidas
- Bebidas

A Produção poderá criar, renomear, arquivar e ordenar categorias adicionais. Combos serão tratados em módulo próprio, mas aparecem como categoria operacional no carrinho.

### 4.2 Cálculos

- Lucro bruto unitário = preço de venda − preço de custo.
- Margem percentual = lucro bruto unitário ÷ preço de venda × 100.

O sistema também exibirá custo total e lucro estimado com base na quantidade atual.

### 4.3 Baixa de estoque

Não haverá reserva de estoque ao adicionar produtos ao carrinho.

Fluxo obrigatório:

1. o usuário adiciona itens ao carrinho;
2. o sistema exibe a disponibilidade atual;
3. no momento de concluir o pagamento, o sistema valida novamente o estoque;
4. se houver quantidade suficiente, a venda é registrada e o estoque é baixado na mesma transação;
5. se não houver quantidade suficiente, a venda não é concluída e o usuário recebe indicação do item em conflito.

Ao cancelar ou ajustar uma venda concluída, a quantidade correspondente retorna integral ou parcialmente ao estoque.

### 4.4 Alertas

Cada produto terá um limite configurável. Quando a quantidade ficar igual ou inferior ao limite, o sistema exibirá:

- aviso visual no estoque;
- destaque no produto durante a venda;
- contador de itens em estoque baixo no painel da Produção.

### 4.5 Movimentações manuais

Tipos obrigatórios:

- Compra
- Entrada manual
- Correção positiva
- Correção negativa
- Perda
- Quebra
- Consumo interno
- Cortesia
- Devolução
- Transferência entre eventos

Toda movimentação exigirá quantidade, data, motivo e responsável. Algumas poderão aceitar observação e valor de custo associado.

## 5. Módulo de combos

Um combo será composto por produtos já cadastrados.

Cada combo terá:

- nome;
- descrição opcional;
- lista de componentes;
- quantidade de cada componente;
- preço de venda do combo;
- status ativo ou arquivado.

O sistema calculará:

- custo total do combo;
- lucro bruto do combo;
- margem do combo;
- valor total caso os componentes fossem vendidos individualmente;
- lucro caso fossem vendidos individualmente;
- diferença de faturamento;
- diferença de lucro.

Na venda de um combo, o estoque será baixado dos componentes, e não de uma quantidade artificial do combo. A disponibilidade será determinada pelo componente limitante.

## 6. Módulo de vouchers

O voucher é uma entidade central do sistema.

### 6.1 Cadastro

Cada voucher terá:

- nome;
- código único automático ou manual;
- valor inicial;
- saldo atual;
- origem: vendido previamente, vendido no local ou cortesia;
- evento;
- mesa vinculada opcional;
- regras de uso;
- estado;
- observação opcional;
- histórico de movimentações e compras.

Códigos manuais deverão ser validados para impedir duplicidade dentro do sistema.

### 6.2 Regras de uso

O valor máximo utilizável é limitado pelo saldo do voucher. As regras definem o que pode ser consumido.

O editor deverá ser visual, dividido em blocos, seletores, chips e cartões, e não em uma lista longa.

Regras previstas:

- somente comidas;
- somente bebidas;
- somente combos;
- produtos específicos;
- quantidade máxima de comidas;
- quantidade máxima de bebidas;
- quantidade máxima de combos;
- quantidade máxima por produto;
- período de validade;
- mesa específica opcional.

As regras poderão ser combinadas entre si. O sistema deverá calcular automaticamente quais itens do carrinho são elegíveis.

### 6.3 Uso

- Um voucher não poderá ser combinado com outro voucher na mesma venda.
- Um voucher poderá ser combinado com uma segunda forma de pagamento.
- O usuário poderá aplicar apenas parte do saldo.
- O sistema mostrará valor elegível, valor utilizado, saldo restante e valor restante da compra.
- Voucher vinculado à mesa aparecerá automaticamente.
- Voucher não vinculado poderá ser aplicado pelo código.
- No Balcão, o vínculo será temporário e desaparecerá após a conclusão ou cancelamento do carrinho atual.

### 6.4 Estados

- Ativo
- Parcialmente utilizado
- Esgotado
- Cancelado
- Expirado
- Arquivado

Vouchers cancelados serão exibidos em seção separada e poderão ser reativados. Um voucher utilizado não será apagado fisicamente; a exclusão operacional será uma operação de arquivamento ou exclusão lógica, preservada na auditoria.

### 6.5 Financeiro do voucher

A venda ou carga paga de um voucher gera entrada financeira específica. Voucher cortesia não gera entrada financeira.

O consumo de voucher quita uma venda, mas não gera uma segunda entrada de dinheiro. Os painéis deverão separar:

- valor de vouchers vendidos;
- valor de vouchers cortesia emitidos;
- saldo total de vouchers;
- valor consumido por vouchers;
- vendas de produtos quitadas com voucher.

## 7. Mesas e Balcão

### 7.1 Cadastro e estados

A Produção poderá:

- criar mesa;
- nomear e renomear;
- ordenar;
- arquivar;
- excluir logicamente quando permitido;
- encerrar manualmente.

Cada mesa poderá permanecer aberta por decisão operacional, mesmo após várias vendas. Todos os produtos são pagos no momento da compra; não existe conta pendente para pagamento posterior.

Cada pagamento gera uma venda concluída vinculada à mesa e ao seu histórico.

Estados sugeridos:

- Ativa
- Encerrada
- Arquivada

### 7.2 Balcão

O Balcão será uma mesa fixa especial:

- criada automaticamente;
- não poderá ser excluída ou arquivada;
- atenderá vendas diretas;
- não manterá voucher vinculado após concluir a compra;
- terá histórico próprio de vendas.

### 7.3 Carrinho

Dentro da mesa, o carrinho exibirá produtos organizados por:

- Comidas
- Bebidas
- Combos

Recursos obrigatórios:

- pesquisa;
- filtro por categoria;
- preço visível;
- quantidade disponível;
- aumentar e diminuir quantidade;
- remover item;
- subtotal por item;
- total do carrinho;
- aviso de estoque baixo;
- validação final do estoque;
- aplicação de voucher;
- pagamento simples ou misto.

## 8. Pagamentos

### 8.1 Vendas de produtos

Formas:

- Cartão
- Pix
- Dinheiro
- Voucher
- Misto

### 8.2 Pagamento misto

O modo misto exibirá dois blocos de pagamento. Em cada bloco, o usuário escolherá a forma e informará o valor.

Regras:

- as formas não poderão ser idênticas;
- apenas um dos blocos poderá ser voucher;
- a soma deverá cobrir o total;
- excesso somente será aceito quando uma das formas for dinheiro;
- o troco será calculado exclusivamente sobre o valor entregue em dinheiro;
- o sistema mostrará valor restante em tempo real.

### 8.3 Cancelamento e edição

Venda concluída não será sobrescrita. Edições criarão ajustes vinculados à venda original.

Ao reduzir ou cancelar itens:

- estoque retorna proporcionalmente;
- valores financeiros são estornados proporcionalmente às formas originais;
- saldo do voucher retorna proporcionalmente quando aplicável;
- lucro e caixa são recalculados;
- auditoria registra antes, depois, justificativa, usuário, data e hora.

Ações realizadas pelo Caixa exigirão senha da Produção.

## 9. Caixa e indicadores

O módulo financeiro estará disponível para a Produção.

### 9.1 Visões obrigatórias

- entradas em dinheiro;
- entradas em Pix;
- entradas em cartão;
- entradas por venda de voucher;
- vendas quitadas com voucher;
- faturamento de produtos;
- faturamento de ingressos;
- faturamento por categoria;
- estornos;
- despesas pagas;
- despesas em aberto;
- valor necessário para cobrir despesas;
- lucro bruto dos produtos;
- resultado do evento;
- saldo financeiro realizado.

O lucro poderá permanecer negativo até que receitas e margens cubram as despesas.

### 9.2 Abertura e fechamento

Recursos planejados:

- abertura de caixa;
- valor inicial em dinheiro;
- suprimento;
- sangria;
- valor esperado;
- contagem final;
- diferença;
- fechamento;
- reabertura protegida e auditada.

## 10. Despesas

A Produção poderá criar categorias e despesas livremente.

Exemplos:

- Espaço
- Iluminação
- DJ
- Fotografia
- Marketing
- Seguranças
- Bombeiros
- Terceirizados

Cada despesa terá:

- nome;
- categoria;
- valor total;
- estado;
- pagamentos vinculados;
- saldo em aberto;
- data;
- forma de pagamento;
- observação;
- histórico de alterações.

Estados e cores:

- Pago: verde
- Parcial: amarelo
- Em aberto: vermelho

No estado parcial, o card exibirá campo para registrar valor pago. Cada parcela deverá ter data, forma e observação própria e gerar saída financeira correspondente.

## 11. Ingressos

Apenas a Produção terá acesso.

### 11.1 Lotes

Cada lote terá:

- nome;
- quantidade total;
- quantidade disponível;
- valor unitário;
- status;
- histórico.

A criação do lote não registra ingressos como pagos.

### 11.2 Lançamento

Ao lançar ingressos, o usuário selecionará um lote com disponibilidade e poderá vender uma ou várias unidades em uma única operação.

Cada ingresso terá:

- código único automático ou manual;
- nome individual ou nome de grupo;
- lote;
- valor registrado;
- forma registrada: Sympla, WhatsApp ou dinheiro;
- indicador de cortesia;
- status.

Não haverá QR Code.

Ingressos poderão ser editados, cancelados ou excluídos logicamente. A auditoria preservará as informações anteriores. Cortesias terão valor financeiro zero e relatório separado.

## 12. Auditoria

A auditoria registrará toda ação relevante:

- criação;
- edição;
- venda;
- pagamento;
- cancelamento;
- estorno;
- exclusão lógica;
- reativação;
- alteração de senha ou configuração;
- movimentação de estoque;
- uso e devolução de voucher;
- despesa e pagamento parcial;
- backup, importação e restauração.

Cada registro conterá:

- data e hora;
- evento;
- perfil responsável;
- módulo;
- ação;
- entidade e identificador;
- dados anteriores;
- dados posteriores;
- justificativa quando exigida.

A interface terá filtros por período, módulo, ação, perfil e entidade.

## 13. Configurações

Disponível apenas para Produção.

Seções previstas:

- identidade do sistema;
- senha e segurança;
- eventos;
- categorias;
- formas de pagamento;
- comportamento de caixa;
- alertas de estoque;
- diretórios de backup;
- frequência de backup automático;
- importação e restauração;
- aparência;
- dados e manutenção.

## 14. Backup e recuperação

Recursos obrigatórios:

- backup automático;
- backup ao encerrar evento;
- backup manual;
- importação de arquivo de backup;
- restauração de backup;
- pasta configurável;
- suporte a pendrive e HD externo;
- verificação de integridade;
- identificação de versão do banco;
- confirmação antes de substituir os dados atuais;
- backup de segurança automático antes de qualquer restauração.

## 15. Interface e identidade visual

- tema escuro;
- vermelho vivo como cor de destaque da marca;
- branco para texto principal;
- cinzas para hierarquia visual;
- verde, amarelo e vermelho para estados financeiros;
- componentes grandes e legíveis para operação rápida;
- atalhos de teclado nas ações frequentes;
- confirmações reforçadas para cancelamentos e estornos.

Os ícones serão fornecidos por Lucide React e incluídos no bundle do aplicativo. Nenhum ícone dependerá de CDN ou internet em tempo de execução.

A fonte será empacotada localmente. A proposta inicial é Inter Variable por pacote local, sem requisição externa. A fonte definitiva poderá ser alterada nas decisões de design, mantendo a exigência de uso offline.

## 16. Fora do escopo inicial

- sincronização entre computadores;
- versão web pública;
- aplicativo móvel;
- emissão fiscal;
- integração com maquineta;
- QR Code de ingresso;
- pagamento posterior da mesa;
- estoque reservado por carrinho;
- dependência de serviço em nuvem.
