const calculadora = {
  render() {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">'
      + '<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px">'
      + '<button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">&#8249;</button>'
      + '<div style="font-size:17px;font-weight:700">&#128176; Calculadora de Ganhos</div></div>'
      + '<div style="padding:16px;display:flex;flex-direction:column;gap:12px">'
      + '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px">'
      + '<div style="font-size:12px;font-weight:700;color:#63b3ed;letter-spacing:1px;margin-bottom:12px">PLUS VENDIDOS</div>'
      + '<div style="display:flex;gap:10px">'
      + '<div style="flex:1"><div style="font-size:11px;color:#a0aec0;margin-bottom:4px">Plus R$9,99</div>'
      + '<div style="display:flex;align-items:center;background:#0a0f1e;border:1px solid #2a3a55;border-radius:10px;overflow:hidden">'
      + '<button data-id="p999" data-d="-1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#fc8181;font-size:20px;width:40px;cursor:pointer">-</button>'
      + '<input id="inp-p999" type="number" min="0" value="0" oninput="calculadora._calc()" style="flex:1;background:none;border:none;color:#eaf0fb;font-size:18px;font-weight:700;text-align:center;width:0">'
      + '<button data-id="p999" data-d="1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#68d391;font-size:20px;width:40px;cursor:pointer">+</button>'
      + '</div></div>'
      + '<div style="flex:1"><div style="font-size:11px;color:#a0aec0;margin-bottom:4px">Plus R$14,99</div>'
      + '<div style="display:flex;align-items:center;background:#0a0f1e;border:1px solid #2a3a55;border-radius:10px;overflow:hidden">'
      + '<button data-id="p1499" data-d="-1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#fc8181;font-size:20px;width:40px;cursor:pointer">-</button>'
      + '<input id="inp-p1499" type="number" min="0" value="0" oninput="calculadora._calc()" style="flex:1;background:none;border:none;color:#eaf0fb;font-size:18px;font-weight:700;text-align:center;width:0">'
      + '<button data-id="p1499" data-d="1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#68d391;font-size:20px;width:40px;cursor:pointer">+</button>'
      + '</div></div></div></div>'
      + '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:14px;padding:16px">'
      + '<div style="font-size:12px;font-weight:700;color:#f6ad55;letter-spacing:1px;margin-bottom:12px">PACOTES DE MINUTOS</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px">'
      + ['pk60:Pacote 60min:R$25:#68d391','pk100:Pacote 100min:R$44:#63b3ed','pk200:Pacote 200min:R$85:#b794f4'].map(function(s){
          var p=s.split(':');
          return '<div style="display:flex;align-items:center;gap:10px">'
            + '<div style="flex:1"><div style="font-size:12px;color:#a0aec0">'+p[1]+'</div>'
            + '<div style="font-size:11px;color:'+p[3]+'">'+p[2]+'</div></div>'
            + '<div style="display:flex;align-items:center;background:#0a0f1e;border:1px solid #2a3a55;border-radius:10px;overflow:hidden">'
            + '<button data-id="'+p[0]+'" data-d="-1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#fc8181;font-size:18px;width:36px;cursor:pointer">-</button>'
            + '<input id="inp-'+p[0]+'" type="number" min="0" value="0" oninput="calculadora._calc()" style="background:none;border:none;color:#eaf0fb;font-size:16px;font-weight:700;text-align:center;width:40px">'
            + '<button data-id="'+p[0]+'" data-d="1" onclick="calculadora._adjBtn(this)" style="background:none;border:none;color:#68d391;font-size:18px;width:36px;cursor:pointer">+</button>'
            + '</div></div>';
        }).join('')
      + '</div>'
      + '<div id="bonus-aviso" style="display:none;margin-top:10px;background:rgba(104,211,145,0.1);border:1px solid rgba(104,211,145,0.3);border-radius:8px;padding:8px 12px;font-size:12px;color:#68d391;text-align:center">Bonus ativo! Comissao 20% nos pacotes 100 e 200</div>'
      + '</div>'
      + '<div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px">'
      + '<div style="font-size:12px;font-weight:700;color:#a0aec0;letter-spacing:1px;margin-bottom:16px">RESUMO DA SEMANA</div>'
      + '<div id="calc-detalhe" style="margin-bottom:16px"><div style="text-align:center;color:#4a5568;font-size:13px">Insira as quantidades acima</div></div>'
      + '<div style="border-top:1px solid #2a3a55;padding-top:14px;display:flex;justify-content:space-between;align-items:center">'
      + '<div style="font-size:14px;font-weight:700;color:#eaf0fb">TOTAL ESTIMADO</div>'
      + '<div id="calc-total" style="font-size:32px;font-weight:800;color:#68d391">R$ 0,00</div>'
      + '</div></div>'
      + '</div>'
      + ui.bottomNav("home")
      + '</div>';
  },
  _adjBtn(btn) {
    var id = btn.getAttribute('data-id');
    var d  = parseInt(btn.getAttribute('data-d'));
    var inp = document.getElementById('inp-' + id);
    if (!inp) return;
    inp.value = Math.max(0, parseInt(inp.value || 0) + d);
    calculadora._calc();
  },
  _val(id) {
    var el = document.getElementById('inp-' + id);
    return el ? Math.max(0, parseInt(el.value || 0)) : 0;
  },
  _fmt(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); },
  _calc() {
    var p999  = calculadora._val('p999');
    var p1499 = calculadora._val('p1499');
    var pk60  = calculadora._val('pk60');
    var pk100 = calculadora._val('pk100');
    var pk200 = calculadora._val('pk200');
    var pkBonus   = pk100 + pk200;
    var comPacote = pkBonus >= 10 ? 0.20 : 0.15;
    var ganhoP999  = p999  * 9.99  * 0.90;
    var ganhoP1499 = p1499 * 14.99 * 0.90;
    var ganhoPk60  = pk60  * 25    * 0.15;
    var ganhoPk100 = pk100 * 44    * comPacote;
    var ganhoPk200 = pk200 * 85    * comPacote;
    var total = ganhoP999 + ganhoP1499 + ganhoPk60 + ganhoPk100 + ganhoPk200;
    var aviso = document.getElementById('bonus-aviso');
    if (aviso) aviso.style.display = pkBonus >= 10 ? 'block' : 'none';
    var linhas = [];
    if (p999)  linhas.push({ label: p999+'x Plus R$9,99',    valor: ganhoP999,  pct: '90%' });
    if (p1499) linhas.push({ label: p1499+'x Plus R$14,99',  valor: ganhoP1499, pct: '90%' });
    if (pk60)  linhas.push({ label: pk60+'x Pacote 60min',   valor: ganhoPk60,  pct: '15%' });
    if (pk100) linhas.push({ label: pk100+'x Pacote 100min', valor: ganhoPk100, pct: (comPacote*100)+'%' });
    if (pk200) linhas.push({ label: pk200+'x Pacote 200min', valor: ganhoPk200, pct: (comPacote*100)+'%' });
    var detalhe = document.getElementById('calc-detalhe');
    if (detalhe) {
      detalhe.innerHTML = linhas.length === 0
        ? '<div style="text-align:center;color:#4a5568;font-size:13px">Insira as quantidades acima</div>'
        : linhas.map(function(l) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #2a3a55">'
              + '<div><div style="font-size:13px;color:#eaf0fb">' + l.label + '</div>'
              + '<div style="font-size:10px;color:#718096">Comissao ' + l.pct + '</div></div>'
              + '<div style="font-size:14px;font-weight:700;color:#68d391">' + calculadora._fmt(l.valor) + '</div></div>';
          }).join('');
    }
    var totalEl = document.getElementById('calc-total');
    if (totalEl) totalEl.textContent = calculadora._fmt(total);
  }
};