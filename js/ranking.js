const ranking = {
  _BADGES_DEF: [
    { id: 'JORNADAS', label: 'Jornadas', icon: '💪' },
    { id: 'STREAK', label: 'Streak', icon: '🔥' },
    { id: 'TOP3_MES', label: 'Top 3', icon: '🦸' },
    { id: 'PONTUAL', label: 'Pontualidade', icon: '🎯' },
    { id: 'SEM_CANCELAMENTO_MES', label: 'Mês Perfeito', icon: '🏆' },
    { id: 'MADRUGADOR', label: 'Madrugador', icon: '🚀' },
    { id: 'ACADEMY', label: 'Academy', icon: '🎓' },
    { id: 'INDICACAO', label: 'Indicações', icon: '🤝' },
  ],

  _periodo: 'SEMANAL',

  async render() {
    document.getElementById('app').innerHTML = `
      <div style="height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700">🏆 Ranking & Conquistas</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px;padding-bottom:100px" id="ranking-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando dados...</div>
        </div>
        ${ui.bottomNav("ranking")}
      </div>`;
    this._load();
  },

  async _load() {
    const el = document.getElementById('ranking-content');
    if (!el) return;
    try {
      const [rankRes, badgeRes] = await Promise.all([
        api.get('GET_RANKING_SEMANAL', { periodo: this._periodo }),
        api.get('GET_BADGES')
      ]);
      const eu = state.get('promotor');
      const badges = badgeRes && badgeRes.badges || [];
      const score = eu ? (eu.score_operacional || 0) : 0;
      const meuRank = rankRes.meuNacional || { posicao: '-', pontos: 0 };

      let html = `
        <div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center">
            <div style="background:rgba(246,173,85,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#f6ad55">${score}</div>
              <div style="font-size:9px;color:#a0aec0">TOTAL</div>
            </div>
            <div style="background:rgba(104,211,145,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#68d391">+${meuRank.pontos}</div>
              <div style="font-size:9px;color:#a0aec0">${this._periodo}</div>
            </div>
            <div style="background:rgba(99,179,237,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#63b3ed">${meuRank.posicao}º</div>
              <div style="font-size:9px;color:#a0aec0">POSIÇÃO</div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:16px">
          ${['SEMANAL', 'MENSAL', 'GERAL'].map(p => `
            <button onclick="ranking._setPeriodo('${p}')" style="flex:1;background:${this._periodo === p ? '#4f8ef7' : '#1e2a45'};color:${this._periodo === p ? '#fff' : '#a0aec0'};border:1px solid ${this._periodo === p ? '#4f8ef7' : '#2a3a55'};border-radius:8px;padding:8px;font-size:11px;font-weight:700;cursor:pointer">${p}</button>
          `).join('')}
        </div>

        <div style="background:#16213e;border-radius:12px;padding:4px;display:flex;margin-bottom:12px">
          <button id="tab-rank-nac" onclick="ranking._switchRank('nacional')" style="flex:1;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Nacional</button>
          <button id="tab-rank-reg" onclick="ranking._switchRank('regional')" style="flex:1;background:transparent;color:#a0aec0;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Minha Cidade</button>
        </div>

        <div id="rank-list-nacional">${this._renderLista(rankRes.nacional, eu)}</div>
        <div id="rank-list-regional" style="display:none">${this._renderLista(rankRes.regional, eu, rankRes.cidade)}</div>

        <div style="font-size:11px;color:#a0aec0;font-weight:700;margin:24px 0 10px 0">CONQUISTAS (BADGES)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:24px">
          ${this._BADGES_DEF.map(def => {
            const tem = badges.some(b => b.tipo && b.tipo.startsWith(def.id));
            return `
              <div style="background:#1e2a45;border-radius:12px;padding:10px;text-align:center;opacity:${tem ? 1 : 0.2}">
                <div style="font-size:24px;margin-bottom:4px">${def.icon}</div>
                <div style="font-size:8px;font-weight:700;color:#a0aec0;text-transform:uppercase">${def.label}</div>
              </div>`;
          }).join('')}
        </div>

        <div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:16px;padding:16px;margin-bottom:40px">
          <div style="font-size:12px;font-weight:700;color:#a0aec0;margin-bottom:12px">REGRAS DE PONTUAÇÃO</div>
          ${[['✅ Check-in pontual','+10'],['✅ Check-in atrasado','+5'],['🏁 Checkout','+5'],['🔥 Streak (5 dias)','+25'],['❌ Cancelamento','-20']].map(r => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px">
              <span>${r[0]}</span><span style="font-weight:700;color:${r[1].includes('+')?'#68d391':'#fc8181'}">${r[1]}</span>
            </div>
          `).join('')}
        </div>
      `;
      el.innerHTML = html;
    } catch(e) { el.innerHTML = `<div style="text-align:center;padding:40px;color:#fc8181">Erro ao carregar dados.</div>`; }
  },

  _setPeriodo(p) { this._periodo = p; this._load(); },
  _renderLista(lista, eu, cidade) {
    let html = ''; if (cidade) html += `<div style="font-size:10px;color:#718096;text-align:center;margin-bottom:8px">Exibindo: ${cidade}</div>`;
    if (!lista || !lista.length) return html + '<div style="text-align:center;padding:20px;color:#4a5568">Nenhum dado</div>';
    lista.forEach((p, i) => {
      const isMe = eu && p.user_id === eu.user_id;
      html += `<div style="background:${isMe?'rgba(79,142,247,0.1)':'#1e2a45'};border:1px solid ${isMe?'#4f8ef7':'#2a3a55'};border-radius:12px;padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:10px"><div style="font-size:18px;width:28px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º'}</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${p.nome}</div></div><div style="font-size:16px;font-weight:800;color:#4f8ef7">${p.pontos}</div></div>`;
    });
    return html;
  },
  _switchRank(tipo) {
    const nac = document.getElementById('rank-list-nacional'), reg = document.getElementById('rank-list-regional');
    const bN = document.getElementById('tab-rank-nac'), bR = document.getElementById('tab-rank-reg');
    if (!nac || !reg) return;
    if (tipo === 'nacional') { nac.style.display='block'; reg.style.display='none'; bN.style.background='#4f8ef7'; bR.style.background='none'; }
    else { nac.style.display='none'; reg.style.display='block'; bR.style.background='#4f8ef7'; bN.style.background='none'; }
  }
};
