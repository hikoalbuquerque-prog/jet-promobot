#!/usr/bin/env python3
import os

def patch(label, path, old, new):
    if not os.path.exists(path):
        print(f"[ERRO] {label} -- arquivo nao encontrado: {path}"); return
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    if old not in c:
        print(f"[ERRO] {label} -- trecho nao encontrado"); return
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c.replace(old, new, 1))
    print(f"[OK]   {label}")

CHUVA  = "\U0001F327\uFE0F"
ONIBUS = "\U0001F68C"
SAUDE  = "\U0001F3E5"

MODAL = (
    "    var ov=document.createElement('div');\n"
    "    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center';\n"
    "    ov.innerHTML='<div style=\"background:#1e2a45;border:1px solid #2a3a55;border-radius:24px 24px 0 0;padding:24px 20px 32px;width:100%;max-width:430px\">'\n"
    "      +'<div style=\"font-size:17px;font-weight:700;margin-bottom:6px\">'+titulo+'</div>'\n"
    "      +'<div style=\"font-size:13px;color:#a0aec0;margin-bottom:20px\">'+msg+'</div>'\n"
    "      +'<div style=\"display:flex;flex-direction:column;gap:10px\">'\n"
    f"      +'<button data-m=\"CHUVA\" data-c=\"1\" style=\"background:rgba(99,179,237,.15);border:1px solid rgba(99,179,237,.3);color:#63b3ed;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer\">{CHUVA} Chuva ou condi\u00e7\u00e3o clim\u00e1tica</button>'\n"
    f"      +'<button data-m=\"TRANSPORTE\" data-c=\"0\" style=\"background:rgba(245,183,0,.1);border:1px solid rgba(245,183,0,.25);color:#f5b700;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer\">{ONIBUS} Problema de transporte</button>'\n"
    f"      +'<button data-m=\"SAUDE\" data-c=\"0\" style=\"background:rgba(252,129,129,.1);border:1px solid rgba(252,129,129,.25);color:#fc8181;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer\">{SAUDE} Sa\u00fade</button>'\n"
    "      +'<button data-m=\"OUTRO\" data-c=\"0\" style=\"background:#1e2a45;border:1px solid #2a3a55;color:#a0aec0;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer\">Outro motivo</button>'\n"
    "      +'<button data-m=\"CANCELAR\" style=\"background:none;border:none;color:#6c7a8d;padding:10px;font-size:14px;cursor:pointer\">Cancelar</button>'\n"
    "      +'</div></div>';\n"
    "    ov.querySelectorAll('button[data-m]').forEach(function(b){\n"
    "      b.addEventListener('click',function(){\n"
    "        document.body.removeChild(ov);\n"
    "        var mv=b.getAttribute('data-m');\n"
    "        if(mv==='CANCELAR'){resolve(null);return;}\n"
    "        resolve({motivo_ocorrencia:mv,ocorrencia_climatica:b.getAttribute('data-c')==='1'});\n"
    "      });\n"
    "    });\n"
    "    document.body.appendChild(ov);\n"
)

OP_HELPER = (
    "// ---- motivo_ocorrencia helpers ----\n"
    "function _selecionarMotivo(titulo,msg){\n"
    "  return new Promise(function(resolve){\n"
    + MODAL +
    "  });\n"
    "}\n"
    "function _minutosAtraso(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((a-b)/60000);}\n"
    "function _minutosAntecipado(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((b-a)/60000);}\n\n"
)

CLT_HELPER = (
    "// ---- motivo_ocorrencia CLT helpers ----\n"
    "function _selecionarMotivoCLT(titulo,msg){\n"
    "  return new Promise(function(resolve){\n"
    + MODAL +
    "  });\n"
    "}\n"
    "function _minutosAtrasoCLT(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((a-b)/60000);}\n"
    "function _minutosAntecipadoCLT(s){if(!s)return 0;var a=new Date(),p=String(s).substring(0,5).split(':'),b=new Date();b.setHours(parseInt(p[0]),parseInt(p[1]),0,0);return Math.floor((b-a)/60000);}\n\n"
)

# operacao.js
OP = "public/js/operacao.js"
with open(OP,'r',encoding='utf-8') as f: op=f.read()
if '_selecionarMotivo' not in op:
    with open(OP,'w',encoding='utf-8') as f: f.write(OP_HELPER+op)
    print("[OK]   Helper _selecionarMotivo -> operacao.js")
else:
    print("[SKIP] Helper ja existe em operacao.js")

patch("1 -- Checkin MEI atraso", OP,
    "    ui.setLoading('btn-checkin', true);\n"
    "    try {\n"
    "      const res = await api.post({\n"
    "        evento:     'CHECKIN',\n"
    "        jornada_id: jornada?.jornada_id,\n"
    "        slot_id:    slot?.slot_id,\n"
    "        lat:        g.lat,\n"
    "        lng:        g.lng,\n"
    "        accuracy:   g.accuracy,\n"
    "        is_mock:    g.isMock || false,\n"
    "      });",
    "    const _am=_minutosAtraso(slot?.inicio);let _mc=null;\n"
    "    if(_am>5){_mc=await _selecionarMotivo('Check-in com atraso de '+_am+' min','Informe o motivo para n\u00e3o afetar sua pontua\u00e7\u00e3o.');}\n"
    "    ui.setLoading('btn-checkin', true);\n"
    "    try {\n"
    "      const res = await api.post({\n"
    "        evento:     'CHECKIN',\n"
    "        jornada_id: jornada?.jornada_id,\n"
    "        slot_id:    slot?.slot_id,\n"
    "        lat:        g.lat,\n"
    "        lng:        g.lng,\n"
    "        accuracy:   g.accuracy,\n"
    "        is_mock:    g.isMock || false,\n"
    "        ...(_mc||{}),\n"
    "      });"
)

patch("2 -- Checkout MEI antecipado", OP,
    "  async _executarCheckout(excepcional = false) {\n"
    "    const jornada = state.loadJornada();\n"
    "    const g       = state.get('gps');\n"
    "    ui.setLoading('btn-checkout', true);\n"
    "\n"
    "    const payload = { jornada_id: jornada?.jornada_id };\n"
    "    if (g?.ok && !excepcional) { payload.lat = g.lat; payload.lng = g.lng; payload.accuracy = g.accuracy; }\n"
    "    if (excepcional) payload.motivo = 'EXCEPCIONAL_SEM_GPS';",
    "  async _executarCheckout(excepcional = false) {\n"
    "    const jornada = state.loadJornada();\n"
    "    const slot    = state.get('slot');\n"
    "    const g       = state.get('gps');\n"
    "    const _an=_minutosAntecipado(slot?.fim);let _mco=null;\n"
    "    if(!excepcional&&_an>5){_mco=await _selecionarMotivo('Encerramento antecipado em '+_an+' min','Informe o motivo para n\u00e3o afetar sua pontua\u00e7\u00e3o.');}\n"
    "    ui.setLoading('btn-checkout', true);\n"
    "\n"
    "    const payload = { jornada_id: jornada?.jornada_id };\n"
    "    if (g?.ok && !excepcional) { payload.lat = g.lat; payload.lng = g.lng; payload.accuracy = g.accuracy; }\n"
    "    if (excepcional) payload.motivo = 'EXCEPCIONAL_SEM_GPS';\n"
    "    if (_mco) Object.assign(payload,_mco);"
)

# turnoclt.js
CLT = "public/js/turnoclt.js"
with open(CLT,'r',encoding='utf-8') as f: clt=f.read()
if '_selecionarMotivoCLT' not in clt:
    with open(CLT,'w',encoding='utf-8') as f: f.write(CLT_HELPER+clt)
    print("[OK]   Helper _selecionarMotivoCLT -> turnoclt.js")
else:
    print("[SKIP] Helper CLT ja existe em turnoclt.js")

patch("3 -- Checkin CLT atraso", CLT,
    "    if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }\n\n    const _enviarCheckin = async (lat, lng, accuracy) => {",
    "    const _amclt=_minutosAtrasoCLT(turno.inicio);let _mcclt=null;\n"
    "    if(_amclt>5){_mcclt=await _selecionarMotivoCLT('Check-in com atraso de '+_amclt+' min','Informe o motivo para n\u00e3o afetar sua pontua\u00e7\u00e3o.');}\n"
    "    if (btn) { btn.textContent = 'Registrando...'; btn.disabled = true; }\n\n"
    "    const _enviarCheckin = async (lat, lng, accuracy) => {"
)

patch("4 -- Checkin CLT motivo no payload", CLT,
    "          evento: 'CHECKIN_TURNO_CLT',\n"
    "          turno_id: turnoId,\n"
    "          lat:      lat      || null,\n"
    "          lng:      lng      || null,\n"
    "          accuracy: accuracy || null,\n"
    "        });",
    "          evento: 'CHECKIN_TURNO_CLT',\n"
    "          turno_id: turnoId,\n"
    "          lat:      lat      || null,\n"
    "          lng:      lng      || null,\n"
    "          accuracy: accuracy || null,\n"
    "          ...(_mcclt||{}),\n"
    "        });"
)

patch("5 -- Checkout CLT antecipado", CLT,
    "      const res = await api.post({ evento: 'CHECKOUT_TURNO_CLT', turno_id: turnoId });",
    "      const _turnoA=state.get('turno_clt_ativo')||{};\n"
    "      const _anclt=_minutosAntecipadoCLT(_turnoA.fim);let _mchoclt=null;\n"
    "      if(_anclt>5){_mchoclt=await _selecionarMotivoCLT('Encerramento antecipado em '+_anclt+' min','Informe o motivo para n\u00e3o afetar sua pontua\u00e7\u00e3o.');}\n"
    "      const res = await api.post(Object.assign({evento:'CHECKOUT_TURNO_CLT',turno_id:turnoId},_mchoclt||{}));"
)

print("\n[LEMBRETE] Colunas na planilha (JORNADAS e TURNOS_CLT):")
print("  motivo_ocorrencia | ocorrencia_climatica")
print("\nDeploy:")
print("  gcloud run deploy promo-telegram-gateway-v3 --source . --region southamerica-east1 --quiet")
