#!/usr/bin/env python3
# patch_slots_timer.py — Rodar em ~/GitHub
import os

def patch(label, path, old, new):
    if not os.path.exists(path):
        print(f"[ERRO] {label} -- arquivo nao encontrado"); return
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if old not in c:
        print(f"[ERRO] {label} -- trecho nao encontrado"); return
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c.replace(old, new, 1))
    print(f"[OK]   {label}")

# ══════════════════════════════════════════════════════════════
# 1. slot.js — após aceitar: marcar slot como aceito na lista
#    em vez de redirecionar para operacao imediatamente
# ══════════════════════════════════════════════════════════════
patch("1 -- Aceitar slot sem sumir da lista", "public/js/slot.js",
    "      if (res.ok) {\n"
    "        state.saveJornada({ jornada_id: res.jornada_id, slot_id: slotId, status: 'ACEITO' });\n"
    "        ui.toast('✅ Slot aceito! Faça o check-in no horário.', 'success');\n"
    "        setTimeout(() => router.go('operacao'), 1500);\n"
    "      }",
    "      if (res.ok) {\n"
    "        state.saveJornada({ jornada_id: res.jornada_id, slot_id: slotId, status: 'ACEITO' });\n"
    "        ui.toast('\u2705 Slot aceito! Fa\u00e7a o check-in no hor\u00e1rio.', 'success');\n"
    "        // Marcar o botao como aceito sem sumir da lista\n"
    "        btn.textContent = '\u2705 Aceito!';\n"
    "        btn.style.background = '#1e2a45';\n"
    "        btn.style.border = '1px solid #2ecc7144';\n"
    "        btn.style.color = '#2ecc71';\n"
    "        btn.disabled = true;\n"
    "        // Adicionar banner de acao\n"
    "        const card = btn.closest('div[style*=\"border-radius:14px\"]');\n"
    "        if (card) {\n"
    "          const banner = document.createElement('div');\n"
    "          banner.style.cssText = 'margin-top:10px;background:rgba(46,204,113,.1);border:1px solid rgba(46,204,113,.3);border-radius:10px;padding:12px;display:flex;justify-content:space-between;align-items:center';\n"
    "          banner.innerHTML = '<span style=\"font-size:13px;color:#2ecc71;font-weight:600\">\u2705 Slot aceito</span>'\n"
    "            + '<button onclick=\"router.go(\\'operacao\\')\" style=\"background:#2ecc71;color:#000;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer\">\u26a1 Abrir jornada</button>';\n"
    "          card.appendChild(banner);\n"
    "        }\n"
    "      }",
)

# ══════════════════════════════════════════════════════════════
# 2. slot.js — melhorar botão voltar no header
# ══════════════════════════════════════════════════════════════
patch("2 -- Botao voltar maior no slot.js", "public/js/slot.js",
    "          <button onclick=\"router.back()\" style=\"background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer\">\u2039</button>",
    "          <button onclick=\"router.go('home')\" style=\"background:#1e2a45;border:1px solid #2a3a55;color:#eaf0fb;font-size:14px;font-weight:600;padding:8px 16px;border-radius:10px;cursor:pointer\">\u2190 Voltar</button>",
)

# ══════════════════════════════════════════════════════════════
# 3. operacao.js — aviso de fim de slot no onTick
# ══════════════════════════════════════════════════════════════
patch("3 -- Aviso fim de slot no timer", "public/js/operacao.js",
    "    const unsubTimer = timer.onTick(s => {\n"
    "      const el = document.getElementById('timer-display');\n"
    "      if (el) el.textContent = ui.formatTimer(s);\n"
    "      this._atualizarProgress(s);\n"
    "    });\n"
    "    state.set('_timerUnsub', unsubTimer);",
    "    let _avisoFimMostrado = false;\n"
    "    const unsubTimer = timer.onTick(s => {\n"
    "      const el = document.getElementById('timer-display');\n"
    "      if (el) el.textContent = ui.formatTimer(s);\n"
    "      this._atualizarProgress(s);\n"
    "      // Aviso fim de slot\n"
    "      if (!_avisoFimMostrado) {\n"
    "        const _slot = state.get('slot');\n"
    "        const _jorn = state.loadJornada();\n"
    "        if (_slot?.fim && _jorn?.inicio_real) {\n"
    "          const _fimParts = String(_slot.fim).substring(0,5).split(':');\n"
    "          const _fimD = new Date(_jorn.inicio_real);\n"
    "          _fimD.setHours(parseInt(_fimParts[0]), parseInt(_fimParts[1]), 0, 0);\n"
    "          if (_fimD < new Date(_jorn.inicio_real)) _fimD.setDate(_fimD.getDate()+1);\n"
    "          const _restMs = _fimD.getTime() - Date.now();\n"
    "          if (_restMs <= 0 && !document.getElementById('banner-fim-slot')) {\n"
    "            _avisoFimMostrado = true;\n"
    "            const banner = document.createElement('div');\n"
    "            banner.id = 'banner-fim-slot';\n"
    "            banner.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:398px;background:#1e2a45;border:1px solid rgba(241,196,15,.4);border-radius:14px;padding:16px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.5)';\n"
    "            banner.innerHTML = '<div style=\"font-size:15px;font-weight:700;color:#f1c40f;margin-bottom:6px\">\u231b Seu slot terminou \u00e0s ' + String(_slot.fim).substring(0,5) + '</div>'\n"
    "              + '<div style=\"font-size:13px;color:#a0aec0;margin-bottom:14px\">Voc\u00ea ainda est\u00e1 ativo. O que deseja fazer?</div>'\n"
    "              + '<div style=\"display:flex;gap:10px\">'\n"
    "              + '<button onclick=\"document.getElementById(\\'banner-fim-slot\\').remove();router.go(\\'checkout\\')\" style=\"flex:1;background:#e74c3c;color:#fff;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer\">\U0001f3c1 Encerrar agora</button>'\n"
    "              + '<button onclick=\"document.getElementById(\\'banner-fim-slot\\').remove()\" style=\"flex:1;background:rgba(241,196,15,.15);border:1px solid rgba(241,196,15,.3);color:#f1c40f;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer\">\u23f0 Continuar</button>'\n"
    "              + '</div>';\n"
    "            document.body.appendChild(banner);\n"
    "          }\n"
    "        }\n"
    "      }\n"
    "    });",
)

# ══════════════════════════════════════════════════════════════
# 4. slot.js — aviso de checkin tardio ao aceitar slot passado
# ══════════════════════════════════════════════════════════════
patch("4 -- Aviso checkin tardio ao aceitar", "public/js/slot.js",
    "  async _aceitar(slotId) {\n"
    "    const btn = event.target;\n"
    "    btn.textContent = 'Aceitando...';\n"
    "    btn.disabled = true;",
    "  async _aceitar(slotId) {\n"
    "    const btn = event.target;\n"
    "    // Verificar se o horario do slot ja passou\n"
    "    const _allSlots = document.querySelectorAll('[data-slot-id]');\n"
    "    const _slotCard = btn.closest('[data-slot-inicio]');\n"
    "    const _inicio = btn.closest('[data-slot-inicio]')?.getAttribute('data-slot-inicio');\n"
    "    if (_inicio) {\n"
    "      const _iniParts = _inicio.split(':');\n"
    "      const _iniD = new Date(); _iniD.setHours(parseInt(_iniParts[0]),parseInt(_iniParts[1]),0,0);\n"
    "      const _atrasoMin = Math.floor((Date.now() - _iniD.getTime()) / 60000);\n"
    "      if (_atrasoMin > 5) {\n"
    "        if (!confirm('\u26a0\ufe0f Este slot come\u00e7ou h\u00e1 ' + _atrasoMin + ' minutos.\\n\\nVoc\u00ea ir\u00e1 fazer check-in com atraso. Deseja continuar?')) return;\n"
    "      }\n"
    "    }\n"
    "    btn.textContent = 'Aceitando...';\n"
    "    btn.disabled = true;",
)

# Para o data-slot-inicio funcionar, adicionar o atributo no card da lista
patch("4b -- data-slot-inicio no card", "public/js/slot.js",
    "          <button onclick=\"slotScreen._aceitar('${slot.slot_id}')\"\n"
    "            style=\"width:100%;background:#2ecc71;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;padding:13px;cursor:pointer\">\n"
    "            \u2705 Aceitar Slot\n"
    "          </button>",
    "          <button onclick=\"slotScreen._aceitar('${slot.slot_id}')\" data-slot-inicio=\"${slot.inicio||''}\"\n"
    "            style=\"width:100%;background:#2ecc71;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;padding:13px;cursor:pointer\">\n"
    "            \u2705 Aceitar Slot\n"
    "          </button>",
)

print("\nPatch concluido.")
print("Deploy: gcloud run deploy promo-telegram-gateway-v3 --source . --region southamerica-east1 --quiet")curl -s -X POST "https://promo-telegram-gateway-v3-476120210909.southamerica-east1.run.app/app/event" \
  -H "Content-Type: application/json" \
  -d "{\"evento\":\"CRIAR_TURNO_CLT\",\"token\":\"TOKEN_GESTOR_001\",\"user_id\":\"USR_FISCAL_001\",\"data\":\"$(date +%Y-%m-%d)\",\"inicio\":\"08:00\",\"fim\":\"17:00\",\"cargo_clt\":\"FISCAL\",\"zona_nome\":\"Zona Sul SP\"}" | python3 -m json.tool