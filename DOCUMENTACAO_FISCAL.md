# Manual do Fiscal JET — Treinamento e Regras de Turno (Versão 2.0 - Fase 8)

Este documento serve como guia técnico e operacional para Fiscais e Supervisores de Campo no ecossistema JET, refletindo as implementações de IA e monitoramento em tempo real.

## 1. Perfil e Acesso
- **Vínculo:** O Fiscal é um colaborador CLT, com jornada registrada no banco de horas.
- **Acesso:** Painel Gestor (Mobile/Web) com permissões operacionais.
- **Login:** CPF e Data de Nascimento (8 dígitos).

## 2. Início de Turno (Check-in com IA)
- **Foto Obrigatória:** O Fiscal deve tirar uma foto em tempo real ao iniciar o turno.
- **Validação Vision AI:** O sistema utiliza o **Gemini Vision** para analisar a foto. 
    - **Requisito:** A foto deve ser de uma pessoa real e, preferencialmente, uniformizada.
    - **Bloqueio:** Se a IA responder "REPROVADO", o check-in é impedido.
- **Localização:** Registrada no momento do início para auditoria, sem raio obrigatório (pode iniciar de casa ou da base).

## 3. Monitoramento e Ociosidade (Heartbeat)
- **Heartbeat (3 min):** Envio automático da localização para mapa de calor e segurança.
- **Detecção de GPS Falso:** O uso de simuladores de GPS dispara um alerta imediato para a gestão no tópico `GESTAO_FISCAL`.
- **Auditoria "Fiscal Parado":**
    - Se o Fiscal permanecer a menos de **150 metros** de um promotor ativo por **12 minutos** acumulados (4 ciclos de heartbeat), o sistema gera um alerta de ociosidade.
    - O alerta identifica nominalmente com qual promotor o Fiscal está parado.

## 4. Metas e Produtividade (Metas Operacionais)
A performance do Fiscal é medida pelo volume de registros de infrações de usuários:
- **Tipos de Ocorrência Válidos:** Somente `DUPLA_NO_PATINETE` e `MENOR_DE_IDADE` contam para a meta.
- **Meta Diária:** Mínimo de **15 registros**.
- **Meta Semanal:** Mínimo de **100 registros**.
- **Alertas de Produtividade:** Se ao encerrar o turno o Fiscal tiver **< 10 registros** ou **> 20 min de ociosidade**, um alerta de baixa produtividade é enviado à Gestão Regional.

## 5. Registro de Ocorrências (Rigor Técnico)
Para garantir a validade jurídica e operacional dos registros:
- **Foto:** Obrigatória e deve ser tirada no momento da infração (não permite upload da galeria).
- **ID do Ativo:** É obrigatório informar o número do patinete envolvido, que deve ter exatamente **6 dígitos**.
- **Fluxo:** Ocorrência -> Foto -> Número do Patinete -> Descrição.

## 6. Finalização e Coach JET (Checkout)
- **Cálculo Automático:** O encerramento alimenta a aba `BANCO_HORAS` com as horas reais trabalhadas.
- **Feedback IA (Gemini):** O "Coach JET" analisa o desempenho do dia:
    - Compara os registros realizados com as metas (15/100).
    - Avalia o tempo de ociosidade detectado.
    - **Reforço Educacional:** Se as metas não forem atingidas, o Coach recomendará FORTEMENTE que o Fiscal refaça o módulo de treinamento **FIS-01** no JET Academy.

## 7. Roadmap (Roteiro de Visitas)
- O roadmap é dinâmico e focado em **Hotspots de Usuários** dentro da zona de atuação do Fiscal.
- Prioriza áreas com maior incidência histórica de infrações (duplas e menores) para maximizar a eficácia da fiscalização.

---
*Atualizado em: Abril 2026*
*Versão do Sistema: Fase 8 (Consolidada)*
