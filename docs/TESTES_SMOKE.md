# Catálogo Inicial de Testes Smoke

## 1. Padrão

Cada função implementada deverá possuir ao menos um teste smoke individual. O identificador seguirá:

`SMK-<MÓDULO>-<NÚMERO>`

Cada teste deverá declarar:

- objetivo;
- pré-condições;
- dados de entrada;
- passos;
- resultado esperado na interface;
- resultado esperado no banco;
- efeitos esperados em estoque, voucher, caixa e auditoria;
- limpeza ou restauração do banco de teste.

Os testes usarão banco SQLite temporário e dados determinísticos. Nenhum teste dependerá de internet.

## 2. Eventos

| ID          | Cenário         | Resultado essencial                            |
| ----------- | --------------- | ---------------------------------------------- |
| SMK-EVT-001 | Criar evento    | Evento criado e auditado                       |
| SMK-EVT-002 | Editar evento   | Dados atualizados sem alterar ID               |
| SMK-EVT-003 | Encerrar evento | Novas operações bloqueadas e backup disparado  |
| SMK-EVT-004 | Reabrir evento  | Senha exigida e auditoria registrada           |
| SMK-EVT-005 | Arquivar evento | Evento sai da lista ativa e mantém histórico   |
| SMK-EVT-006 | Alternar evento | Dados operacionais não se misturam             |
| SMK-EVT-007 | Copiar catálogo | Produtos copiados sem copiar estoque ou vendas |

## 3. Perfis e autorização

| ID          | Cenário                                     | Resultado essencial                                            |
| ----------- | ------------------------------------------- | -------------------------------------------------------------- |
| SMK-AUT-001 | Entrar como Caixa                           | Somente mesas e estoque operacional disponíveis                |
| SMK-AUT-002 | Entrar como Produção                        | Todos os módulos disponíveis                                   |
| SMK-AUT-003 | Trocar Caixa para Produção com senha válida | Acesso liberado e auditado                                     |
| SMK-AUT-004 | Trocar com senha inválida                   | Acesso negado sem expor detalhes                               |
| SMK-AUT-005 | Caixa tenta cancelar venda                  | Solicitação de senha da Produção                               |
| SMK-AUT-006 | Autorizar cancelamento do Caixa             | Ação executada e autorizador registrado                        |
| SMK-AUT-007 | Alterar senha da Produção                   | Hash atualizado e senha antiga invalidada                      |
| SMK-AUT-008 | Confirmar ocultação de custos ao Caixa      | Custo, margem e lucro não aparecem nem são retornados pelo IPC |

## 4. Produtos e estoque

| ID          | Cenário                          | Resultado essencial                                |
| ----------- | -------------------------------- | -------------------------------------------------- |
| SMK-EST-001 | Criar categoria                  | Categoria disponível no evento                     |
| SMK-EST-002 | Renomear categoria               | Produtos permanecem vinculados                     |
| SMK-EST-003 | Arquivar categoria com histórico | Histórico preservado                               |
| SMK-EST-004 | Cadastrar produto                | Produto criado com cálculos corretos               |
| SMK-EST-005 | Editar preço e custo             | Margem e lucro recalculados                        |
| SMK-EST-006 | Dar entrada                      | Quantidade aumenta e movimento é criado            |
| SMK-EST-007 | Compra                           | Entrada registra quantidade e custo                |
| SMK-EST-008 | Correção positiva                | Quantidade aumenta com motivo                      |
| SMK-EST-009 | Correção negativa                | Quantidade reduz sem ficar negativa                |
| SMK-EST-010 | Perda                            | Quantidade reduz e auditoria registra motivo       |
| SMK-EST-011 | Quebra                           | Quantidade reduz e movimento correto é criado      |
| SMK-EST-012 | Consumo interno                  | Saída sem venda financeira                         |
| SMK-EST-013 | Cortesia de estoque              | Saída classificada separadamente                   |
| SMK-EST-014 | Devolução                        | Entrada vinculada à origem quando informada        |
| SMK-EST-015 | Transferência entre eventos      | Saída e entrada atômicas com grupo comum           |
| SMK-EST-016 | Alerta de limite                 | Aviso aparece quando quantidade atinge limite      |
| SMK-EST-017 | Carrinho não reserva estoque     | Quantidade permanece igual antes do pagamento      |
| SMK-EST-018 | Venda com estoque suficiente     | Baixa ocorre somente após concluir                 |
| SMK-EST-019 | Venda sem estoque suficiente     | Venda inteira rejeitada e nenhum efeito persistido |
| SMK-EST-020 | Arquivar produto                 | Produto some da venda e histórico permanece        |

## 5. Combos

| ID          | Cenário                       | Resultado essencial                        |
| ----------- | ----------------------------- | ------------------------------------------ |
| SMK-CMB-001 | Criar combo                   | Componentes e quantidades salvos           |
| SMK-CMB-002 | Calcular custo                | Soma dos custos dos componentes correta    |
| SMK-CMB-003 | Calcular lucro bruto e margem | Resultados corretos em centavos            |
| SMK-CMB-004 | Comparar venda individual     | Diferenças de faturamento e lucro corretas |
| SMK-CMB-005 | Calcular disponibilidade      | Componente limitante determina quantidade  |
| SMK-CMB-006 | Vender combo                  | Estoque dos componentes é baixado          |
| SMK-CMB-007 | Impedir combo insuficiente    | Nenhum componente é parcialmente baixado   |
| SMK-CMB-008 | Cancelar combo vendido        | Componentes retornam ao estoque            |

## 6. Mesas e Balcão

| ID          | Cenário                           | Resultado essencial                         |
| ----------- | --------------------------------- | ------------------------------------------- |
| SMK-MSA-001 | Criar mesa                        | Mesa ativa e auditada                       |
| SMK-MSA-002 | Renomear mesa                     | Histórico continua vinculado ao ID original |
| SMK-MSA-003 | Encerrar mesa                     | Novas vendas ficam bloqueadas               |
| SMK-MSA-004 | Reabrir mesa                      | Operação protegida e auditada               |
| SMK-MSA-005 | Arquivar mesa                     | Histórico preservado                        |
| SMK-MSA-006 | Vender várias vezes na mesma mesa | Cada pagamento cria venda independente      |
| SMK-MSA-007 | Confirmar pagamento imediato      | Não existe saldo pendente da mesa           |
| SMK-MSA-008 | Proteger Balcão                   | Não permite excluir ou arquivar             |
| SMK-MSA-009 | Limpar carrinho do Balcão         | Carrinho e voucher temporário são removidos |

## 7. Vouchers

| ID          | Cenário                       | Resultado essencial                              |
| ----------- | ----------------------------- | ------------------------------------------------ |
| SMK-VCH-001 | Criar voucher automático      | Código único gerado                              |
| SMK-VCH-002 | Criar voucher manual          | Código informado preservado                      |
| SMK-VCH-003 | Rejeitar código duplicado     | Nenhum voucher duplicado criado                  |
| SMK-VCH-004 | Emitir cortesia               | Saldo criado sem entrada financeira              |
| SMK-VCH-005 | Vender voucher no local       | Entrada financeira específica criada             |
| SMK-VCH-006 | Registrar voucher pré-vendido | Origem correta preservada                        |
| SMK-VCH-007 | Vincular à mesa               | Voucher aparece automaticamente                  |
| SMK-VCH-008 | Aplicar por código            | Voucher válido carregado no carrinho             |
| SMK-VCH-009 | Aplicar regra somente comida  | Bebidas e combos ficam inelegíveis               |
| SMK-VCH-010 | Aplicar regra somente bebida  | Comidas e combos ficam inelegíveis               |
| SMK-VCH-011 | Aplicar regra somente combo   | Produtos individuais ficam inelegíveis           |
| SMK-VCH-012 | Restringir produto específico | Apenas produto permitido é coberto               |
| SMK-VCH-013 | Limitar quantidade de comida  | Excedente permanece a pagar                      |
| SMK-VCH-014 | Limitar quantidade de bebida  | Excedente permanece a pagar                      |
| SMK-VCH-015 | Limitar quantidade de combo   | Excedente permanece a pagar                      |
| SMK-VCH-016 | Uso parcial                   | Saldo restante calculado corretamente            |
| SMK-VCH-017 | Esgotar voucher               | Estado muda para esgotado                        |
| SMK-VCH-018 | Impedir dois vouchers         | Segundo voucher rejeitado                        |
| SMK-VCH-019 | Pagamento misto com voucher   | Valor restante é quitado pela outra forma        |
| SMK-VCH-020 | Cancelar venda com voucher    | Saldo retorna proporcionalmente                  |
| SMK-VCH-021 | Editar quantidade após uso    | Diferença retorna ao voucher e estoque           |
| SMK-VCH-022 | Cancelar voucher              | Uso bloqueado e item aparece na seção cancelados |
| SMK-VCH-023 | Reativar voucher              | Saldo e histórico preservados                    |
| SMK-VCH-024 | Expirar voucher               | Uso bloqueado após validade                      |
| SMK-VCH-025 | Voucher no Balcão             | Vínculo some após a compra                       |

## 8. Pagamentos e vendas

| ID          | Cenário                        | Resultado essencial                                                    |
| ----------- | ------------------------------ | ---------------------------------------------------------------------- |
| SMK-PGT-001 | Pagamento em cartão            | Venda e entrada em cartão criadas                                      |
| SMK-PGT-002 | Pagamento em Pix               | Venda e entrada em Pix criadas                                         |
| SMK-PGT-003 | Pagamento em dinheiro exato    | Troco zero                                                             |
| SMK-PGT-004 | Pagamento em dinheiro superior | Troco correto                                                          |
| SMK-PGT-005 | Pagamento misto                | Dois registros com soma correta                                        |
| SMK-PGT-006 | Misto com dinheiro e troco     | Troco calculado apenas sobre dinheiro                                  |
| SMK-PGT-007 | Misto insuficiente             | Finalização bloqueada                                                  |
| SMK-PGT-008 | Misto com formas iguais        | Finalização bloqueada                                                  |
| SMK-PGT-009 | Misto com dois vouchers        | Finalização bloqueada                                                  |
| SMK-VND-001 | Concluir venda                 | Venda, itens, pagamentos, estoque, financeiro e auditoria consistentes |
| SMK-VND-002 | Cancelar venda integral        | Estoque e pagamentos totalmente estornados                             |
| SMK-VND-003 | Cancelar item                  | Apenas item selecionado é revertido                                    |
| SMK-VND-004 | Reduzir quantidade             | Diferença de estoque e valor é revertida                               |
| SMK-VND-005 | Aumentar quantidade            | Diferença é validada, cobrada e baixada                                |
| SMK-VND-006 | Alterar preço autorizado       | Ajuste financeiro e snapshot são registrados                           |
| SMK-VND-007 | Estorno misto proporcional     | Cada forma recebe proporção correta                                    |
| SMK-VND-008 | Falha no meio da transação     | Rollback deixa todas as entidades inalteradas                          |
| SMK-VND-009 | Preservar venda original       | Ajuste não sobrescreve registro original                               |

## 9. Caixa

| ID          | Cenário                           | Resultado essencial                                      |
| ----------- | --------------------------------- | -------------------------------------------------------- |
| SMK-CAX-001 | Abrir caixa                       | Saldo inicial registrado                                 |
| SMK-CAX-002 | Registrar suprimento              | Entrada de caixa criada                                  |
| SMK-CAX-003 | Registrar sangria                 | Saída de caixa criada                                    |
| SMK-CAX-004 | Separar formas                    | Cartão, Pix, dinheiro e voucher exibidos separadamente   |
| SMK-CAX-005 | Não duplicar voucher              | Venda do voucher e consumo não viram duas entradas reais |
| SMK-CAX-006 | Calcular faturamento de produtos  | Cancelamentos e ajustes considerados                     |
| SMK-CAX-007 | Calcular faturamento de ingressos | Apenas ingressos válidos e pagos considerados            |
| SMK-CAX-008 | Calcular resultado projetado      | Todas as despesas consideradas                           |
| SMK-CAX-009 | Calcular saldo realizado          | Apenas entradas e saídas efetivadas consideradas         |
| SMK-CAX-010 | Fechar caixa                      | Esperado, contado e diferença calculados                 |
| SMK-CAX-011 | Bloquear caixa fechado            | Nova movimentação rejeitada                              |
| SMK-CAX-012 | Reabrir caixa                     | Senha e auditoria obrigatórias                           |

## 10. Despesas

| ID          | Cenário                     | Resultado essencial                          |
| ----------- | --------------------------- | -------------------------------------------- |
| SMK-DSP-001 | Criar categoria             | Categoria disponível no evento               |
| SMK-DSP-002 | Criar despesa em aberto     | Saldo integral em aberto                     |
| SMK-DSP-003 | Registrar pagamento parcial | Estado parcial e saída financeira criada     |
| SMK-DSP-004 | Completar pagamento         | Estado muda para pago                        |
| SMK-DSP-005 | Impedir pagamento excedente | Valor acima do saldo rejeitado               |
| SMK-DSP-006 | Cancelar parcela            | Saída revertida e saldo recalculado          |
| SMK-DSP-007 | Editar despesa              | Histórico anterior preservado na auditoria   |
| SMK-DSP-008 | Arquivar categoria usada    | Despesas históricas permanecem válidas       |
| SMK-DSP-009 | Cores de estado             | Pago verde, parcial amarelo, aberto vermelho |

## 11. Ingressos

| ID          | Cenário                    | Resultado essencial                                      |
| ----------- | -------------------------- | -------------------------------------------------------- |
| SMK-ING-001 | Criar lote                 | Quantidade disponível e valor salvos                     |
| SMK-ING-002 | Confirmar lote não pago    | Nenhuma receita criada na criação                        |
| SMK-ING-003 | Vender ingresso individual | Código e valor registrados                               |
| SMK-ING-004 | Vender vários ingressos    | Uma operação cria quantidade correta                     |
| SMK-ING-005 | Nomear individualmente     | Cada ingresso preserva seu nome                          |
| SMK-ING-006 | Nomear em grupo            | Nome do grupo aplicado conforme escolha                  |
| SMK-ING-007 | Código automático          | Código único gerado                                      |
| SMK-ING-008 | Código manual              | Duplicidade rejeitada                                    |
| SMK-ING-009 | Registrar Sympla           | Forma correta nos relatórios                             |
| SMK-ING-010 | Registrar WhatsApp         | Forma correta nos relatórios                             |
| SMK-ING-011 | Registrar dinheiro         | Entrada financeira correspondente criada                 |
| SMK-ING-012 | Criar cortesia             | Valor zero e relatório separado                          |
| SMK-ING-013 | Impedir excesso do lote    | Operação rejeitada sem criação parcial                   |
| SMK-ING-014 | Editar ingresso            | Dados anteriores auditados                               |
| SMK-ING-015 | Cancelar ingresso          | Disponibilidade do lote recalculada                      |
| SMK-ING-016 | Excluir ingresso           | Exclusão lógica preservada na auditoria                  |
| SMK-ING-017 | Cancelar lote              | Ingressos já lançados não são cancelados automaticamente |
| SMK-ING-018 | Bloquear acesso do Caixa   | Módulo e dados indisponíveis                             |

## 12. Auditoria

| ID          | Cenário                      | Resultado essencial                        |
| ----------- | ---------------------------- | ------------------------------------------ |
| SMK-AUD-001 | Registrar criação            | Evento de criação completo                 |
| SMK-AUD-002 | Registrar edição             | Antes e depois disponíveis                 |
| SMK-AUD-003 | Registrar cancelamento       | Motivo e autorizador disponíveis           |
| SMK-AUD-004 | Filtrar por data             | Somente período selecionado exibido        |
| SMK-AUD-005 | Filtrar por módulo           | Somente módulo selecionado exibido         |
| SMK-AUD-006 | Filtrar por ação             | Somente ação selecionada exibida           |
| SMK-AUD-007 | Proteger imutabilidade       | Interface não permite editar ou apagar log |
| SMK-AUD-008 | Omitir segredo               | Senha e hash não aparecem em before/after  |
| SMK-AUD-009 | Falhar auditoria obrigatória | Operação crítica sofre rollback            |

## 13. Backup e recuperação

| ID          | Cenário                          | Resultado essencial                       |
| ----------- | -------------------------------- | ----------------------------------------- |
| SMK-BKP-001 | Criar backup manual              | Arquivo, manifesto e checksum válidos     |
| SMK-BKP-002 | Criar backup automático          | Frequência configurada respeitada         |
| SMK-BKP-003 | Backup ao encerrar evento        | Arquivo criado antes da conclusão final   |
| SMK-BKP-004 | Salvar em pasta configurada      | Destino correto utilizado                 |
| SMK-BKP-005 | Salvar em unidade externa        | Pendrive ou HD aceito quando disponível   |
| SMK-BKP-006 | Importar backup válido           | Conteúdo validado antes da restauração    |
| SMK-BKP-007 | Rejeitar backup corrompido       | Banco atual permanece intacto             |
| SMK-BKP-008 | Rejeitar versão incompatível     | Mensagem clara e nenhum dado alterado     |
| SMK-BKP-009 | Criar backup pré-restauração     | Estado atual preservado automaticamente   |
| SMK-BKP-010 | Restaurar backup                 | Banco substituído atomicamente e validado |
| SMK-BKP-011 | Falhar durante restauração       | Banco anterior recuperado                 |
| SMK-BKP-012 | Auditar importação e restauração | Histórico completo registrado             |

## 14. Interface offline

| ID         | Cenário              | Resultado essencial                                      |
| ---------- | -------------------- | -------------------------------------------------------- |
| SMK-UI-001 | Abrir sem internet   | Aplicativo inicia e opera normalmente                    |
| SMK-UI-002 | Carregar ícones      | Lucide renderiza sem requisição externa                  |
| SMK-UI-003 | Carregar fonte       | Fonte local renderiza sem requisição externa             |
| SMK-UI-004 | Tema                 | Fundo escuro, destaque vermelho e texto branco aplicados |
| SMK-UI-005 | Estados de despesa   | Cores e textos semânticos corretos                       |
| SMK-UI-006 | Navegação por perfil | Menus respeitam permissões                               |
| SMK-UI-007 | Reiniciar aplicativo | Dados persistidos e integridade mantida                  |

## 15. Regra de expansão

Uma função somente poderá ser marcada como concluída quando:

1. possuir teste unitário quando houver regra calculável;
2. possuir teste de integração quando alterar banco;
3. possuir teste smoke com identificador;
4. validar auditoria quando aplicável;
5. validar rollback em caso de falha crítica;
6. executar sem internet.
