# Manual do Fiscal JET — Treinamento e Regras de Turno (Versão 2.1 - Fase 8)

Este documento serve como guia técnico e operacional para Fiscais e Supervisores de Campo no ecossistema JET, refletindo as implementações de IA e monitoramento em tempo real.

## 1. Perfil e Acesso
- **Vínculo:** O Fiscal é um colaborador CLT, com jornada registrada no banco de horas.
- **Acesso:** App de Promotor / Operacional (PWA).
- **Interface:** O Fiscal utiliza a **Home CLT**, a mesma dos promotores, porém com ferramentas exclusivas de fiscalização ativadas em seu menu de turno.
- **Login:** CPF e Data de Nascimento (DD/MM/AAAA).

## 2. Início de Turno (Check-in)
- **Fluxo:** O Fiscal acessa a aba "Turno", seleciona sua escala do dia e realiza o Check-in.
- **Foto Obrigatória:** O Fiscal deve tirar uma foto em tempo real ao iniciar o turno (quando solicitado).
- **Validação Vision AI:** O sistema utiliza o **Gemini Vision** para analisar a foto. 
    - **Requisito:** A foto deve ser de uma pessoa real e, preferencialmente, uniformizada.
    - **Bloqueio:** Se a IA responder "REPROVADO", o check-in é impedido.
- **Localização:** Registrada no momento do início para auditoria.

## 3. Monitoramento e Ociosidade (Heartbeat)
- **Rastreamento Contínuo:** Durante todo o turno (`EM ANDAMENTO`), a localização é enviada a cada 3 minutos para o mapa de calor e segurança.
- **Detecção de GPS Falso:** O uso de simuladores de GPS dispara um alerta imediato para a gestão no tópico `GESTAO_FISCAL`.
- **Auditoria "Fiscal Parado":**
    - Se o Fiscal permanecer a menos de **150 metros** de um promotor ativo por **12 minutos** acumulados (4 ciclos de heartbeat), o sistema gera um alerta de ociosidade.
    - O alerta identifica nominalmente com qual promotor o Fiscal está parado.

## 4. Metas e Produtividade (Metas Operacionais)
A performance do Fiscal é medida pelo volume de registros de infrações de usuários:
- **Ferramenta:** Botão **🚨 Infração** disponível na tela de turno ativo.
- **Tipos de Ocorrência:** `DUAS_PESSOAS`, `MENOR_IDADE`, `ESTACIONAMENTO_IRREGULAR`, etc.
- **Meta Diária:** Mínimo de **15 registros**.
- **Meta Semanal:** Mínimo de **100 registros**.
- **Alertas de Produtividade:** Se ao encerrar o turno o Fiscal tiver **< 10 registros** ou **> 20 min de ociosidade**, um alerta de baixa produtividade é enviado à Gestão Regional.

## 5. Recursos de Emergência e Suporte
- **Botão SOS (Pânico):** Disponível na tela de turno. Ao ser acionado, envia um alerta imediato com localização para a equipe de segurança e supervisão via Telegram.
- **Registro de Chuva:** Permite notificar a central sobre condições climáticas adversas que impeçam a fiscalização.
- **Suporte / Ocorrência:** Canal direto para relatar problemas técnicos ou operacionais sem sair do app.

## 6. Finalização e Coach JET (Checkout)
- **Cálculo Automático:** O encerramento alimenta a aba `BANCO_HORAS` com as horas reais trabalhadas.
- **Feedback IA (Gemini):** O "Coach JET" analisa o desempenho do dia:
    - Compara os registros realizados com as metas (15/100).
    - Avalia o tempo de ociosidade detectado.
    - **Reforço Educacional:** Se as metas não forem atingidas, o Coach recomendará que o Fiscal refaça o módulo de treinamento **FIS-01** no JET Academy.

## 7. Roadmap e Mapa (Roteiro de Visitas)
- **Roteiro Dinâmico:** O Fiscal visualiza em tempo real quais pontos (slots) possuem promotores ativos para priorizar a fiscalização nessas áreas.
- **Mapa Operacional:** Permite visualizar a posição dos promotores (Ativos vs Pausados) para otimizar o deslocamento.

---
*Atualizado em: Abril 2026*
*Versão do Sistema: Fase 8.1 (Fiscal no App Promotor)*

---
*Atualizado em: Abril 2026*
*Versão do Sistema: Fase 8 (Consolidada)*
