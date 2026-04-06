# Manual do Fiscal JET — Treinamento e Regras de Turno

Este documento serve como guia para o treinamento de Fiscais e Supervisores de Campo no ecossistema JET.

## 1. Perfil e Acesso
- **Vínculo:** O Fiscal é um colaborador CLT.
- **Acesso ao Painel:** O Fiscal possui acesso ao **Painel Gestor** (versão mobile/web), mas com permissões limitadas ao operacional.
- **Login:** Realizado via CPF e Data de Nascimento (8 dígitos).

## 2. Regras de Turno (CLT)
O turno do Fiscal segue as normas da CLT, integradas ao sistema de banco de horas automático.

### Início de Turno (Check-in)
- O Fiscal deve iniciar seu turno através da tela **"Meu Turno"**.
- Diferente dos promotores MEI, o Fiscal **não possui um raio de check-in obrigatório**, permitindo que ele inicie o trabalho de casa ou da base operacional.
- O sistema registra a localização exata no momento do início para auditoria.

### Durante o Turno
- **Heartbeat (3 min):** O sistema envia a localização do Fiscal a cada 3 minutos para compor o mapa de calor e garantir a segurança.
- **Pausas:** O Fiscal pode pausar o turno para almoço ou descanso. O tempo de pausa não conta como hora trabalhada no banco de horas.
- **Registro de Chuva:** Botão rápido para informar intercorrências climáticas que afetem a operação da cidade.

### Roteiro de Visitas (Roadmap)
- Assim que o turno inicia, o sistema libera o **"Roteiro de Visitas (Hoje)"**.
- Este painel lista automaticamente todos os pontos da cidade que possuem **promotores ativos**.
- **Alertas Prioritários:** Pontos com ícone ⚠️ (problemas de ativos ou bateria) aparecem no topo do roteiro para visita imediata.

## 3. Auditoria e Supervisão
O sistema monitora a eficácia da fiscalização através de cruzamento de dados:
- **Visita Automática:** Uma visita é registrada se o Fiscal permanecer a menos de **150 metros** de um slot ocupado por pelo menos **5 minutos**.
- **Relatório de Supervisão:** O Regional consegue ver no mapa o trajeto feito pelo Fiscal e quais pontos foram efetivamente cobertos.

## 4. Finalização (Checkout)
- O encerramento do turno calcula automaticamente as horas trabalhadas e alimenta a aba `BANCO_HORAS`.
- **Mensagem do Coach IA:** Ao encerrar, o Gemini envia um resumo motivacional do dia no Telegram do Fiscal.

## 5. Alertas de Segurança
O Fiscal (e o Líder) recebe notificações em tempo real sobre:
1. **GPS Falso:** Tentativa de uso de simuladores por promotores.
2. **Device ID Duplicado:** Suspeita de um promotor batendo ponto para outro.
3. **Baixo Trust Score:** Promotores com sinal de GPS instável ou suspeito.

---
*Versão do Documento: 1.0 (Fase 8)*
*Última Atualização: Abril 2026*
