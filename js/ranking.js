const ranking = {
  _BADGES_DEF: [
    { id: 'JORNADAS', label: 'Jornadas', icon: '💪', niveis: [
        { label:'10 jornadas',  cor:'#cd7f32', raridade:'Bronze'    },
        { label:'30 jornadas',  cor:'#a0aec0', raridade:'Prata'     },
        { label:'50 jornadas',  cor:'#f6ad55', raridade:'Ouro'      },
        { label:'100 jornadas', cor:'#63b3ed', raridade:'Safira'    },
        { label:'200 jornadas', cor:'#68d391', raridade:'Esmeralda' },
        { label:'500 jornadas', cor:'#b794f4', raridade:'Ametista'  },
        { label:'1000 jornadas',cor:'#ffd700', raridade:'Lendário'  },
    ]},
    { id: 'STREAK', label: 'Streak', icon: '🔥', niveis: [
        { label:'5 dias',   cor:'#cd7f32', raridade:'Bronze'    },
        { label:'10 dias',  cor:'#a0aec0', raridade:'Prata'     },
        { label:'20 dias',  cor:'#f6ad55', raridade:'Ouro'      },
        { label:'30 dias',  cor:'#63b3ed', raridade:'Safira'    },
        { label:'60 dias',  cor:'#68d391', raridade:'Esmeralda' },
        { label:'100 dias', cor:'#b794f4', raridade:'Ametista'  },
    ]},
    { id: 'TOP3_MES', label: 'Top 3', icon: '🦸', niveis: [
        { label:'1x Top 3',  cor:'#cd7f32', raridade:'Bronze'   },
        { label:'3x Top 3',  cor:'#a0aec0', raridade:'Prata'    },
        { label:'6x Top 3',  cor:'#f6ad55', raridade:'Ouro'     },
        { label:'12x Top 3', cor:'#63b3ed', raridade:'Safira'   },
        { label:'24x Top 3', cor:'#b794f4', raridade:'Ametista' },
    ]},
    { id: 'PONTUAL', label: 'Pontualidade', icon: '🎯', niveis: [
        { label:'5 pontuais',   cor:'#cd7f32', raridade:'Bronze'    },
        { label:'15 pontuais',  cor:'#a0aec0', raridade:'Prata'     },
        { label:'30 pontuais',  cor:'#f6ad55', raridade:'Ouro'      },
        { label:'60 pontuais',  cor:'#63b3ed', raridade:'Safira'    },
        { label:'100 pontuais', cor:'#68d391', raridade:'Esmeralda' },
    ]},
    { id: 'INDICACAO', label: 'Indicacoes', icon: '🤝', niveis: [
        { label:'1 indicacao',   cor:'#cd7f32', raridade:'Bronze'    },
        { label:'3 indicacoes',  cor:'#a0aec0', raridade:'Prata'     },
        { label:'5 indicacoes',  cor:'#f6ad55', raridade:'Ouro'      },
        { label:'10 indicacoes', cor:'#63b3ed', raridade:'Safira'    },
        { label:'20 indicacoes', cor:'#68d391', raridade:'Esmeralda' },
    ]},
  ],

  _periodo: 'SEMANAL',

  async render() {
    document.getElementById('app').innerHTML = `
      <div style="height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;overflow:hidden">
        <div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px">
          <button onclick="router.back()" style="background:#1e2a45;border:none;color:#eaf0fb;font-size:20px;width:36px;height:36px;border-radius:50%;cursor:pointer">‹</button>
          <div style="font-size:17px;font-weight:700">🏆 Ranking & Badges</div>
        </div>
        <div style="flex:1;overflow-y:auto;padding:16px" id="ranking-content">
          <div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div>
        </div>
        ${ui.bottomNav("ranking")}
      </div>`;

    this._load();
  },

  async _load() {
    const el = document.getElementById('ranking-content');
    if (!el) return;

    try {
      const results = await Promise.all([
        api.get('GET_RANKING_SEMANAL', { periodo: this._periodo }),
        api.get('GET_BADGES')
      ]);
      const rankRes = results[0];
      const badgeRes = results[1];
      const eu = state.get('promotor');
      const score = eu ? (eu.score_operacional || 0) : 0;
      const streak = eu ? (eu.streak_dias || 0) : 0;
      const badges = badgeRes && badgeRes.badges || [];
      
      const meuRank = rankRes.meuNacional;
      const pos = meuRank ? meuRank.posicao : '-';
      const ganho = meuRank ? meuRank.pontos : 0;

      let html = `
        <div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;margin-bottom:12px">
            <div style="background:rgba(246,173,85,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#f6ad55">${score}</div>
              <div style="font-size:9px;color:#a0aec0">TOTAL</div>
            </div>
            <div style="background:rgba(104,211,145,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#68d391">+${ganho}</div>
              <div style="font-size:9px;color:#a0aec0">${this._periodo}</div>
            </div>
            <div style="background:rgba(99,179,237,0.1);border-radius:10px;padding:10px">
              <div style="font-size:22px;font-weight:800;color:#63b3ed">${pos}º</div>
              <div style="font-size:9px;color:#a0aec0">NACIONAL</div>
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

        <div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin:24px 0 10px 0">MINHAS CONQUISTAS</div>
      `;
      
      this._BADGES_DEF.forEach(function(def) {
        const conquistadasDef = badges.filter(function(b){ return b.tipo && b.tipo.startsWith(def.id); });
        const nivelAtingido = conquistadasDef.length;
        const nivelAtual = nivelAtingido > 0 ? def.niveis[nivelAtingido-1] : null;
        const cor = nivelAtual ? nivelAtual.cor : '#4a5568';
        const opacity = nivelAtingido > 0 ? '1' : '0.35';
        html += `
          <div style="background:#1e2a45;border:1px solid ${cor}44;border-radius:12px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px;opacity:${opacity}">
            <div style="font-size:30px">${def.icon}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:#eaf0fb">${def.label}</div>
              <div style="font-size:11px;color:#718096;margin-top:2px">${nivelAtual ? nivelAtual.label : 'Não conquistado'}</div>
            </div>
          </div>`;
      });

      el.innerHTML = html;

    } catch(e) {
      if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:#e74c3c">Erro ao carregar: ${e.message}</div>`;
    }
  },

  _setPeriodo(p) { this._periodo = p; this._load(); },

  _renderLista(lista, eu, cidade) {
    let html = '';
    if (cidade) html += `<div style="font-size:10px;color:#718096;margin-bottom:8px;text-align:center">Cidade: <b>${cidade}</b></div>`;
    if (!lista || lista.length === 0) return html + '<div style="text-align:center;padding:20px;color:#4a5568">Nenhum dado</div>';

    lista.forEach(function(p, i) {
      const isMe = eu && p.user_id === eu.user_id;
      html += `
        <div style="background:${isMe?'rgba(79,142,247,0.1)':'#1e2a45'};border:1px solid ${isMe?'#4f8ef7':'#2a3a55'};border-radius:12px;padding:12px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px">
          <div style="font-size:18px;width:28px">${i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º'}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:${isMe?'#4f8ef7':'#eaf0fb'}">${p.nome}</div>
            ${p.cidade && !cidade ? `<div style="font-size:10px;color:#718096">${p.cidade}</div>` : ''}
          </div>
          <div style="font-size:16px;font-weight:800;color:#4f8ef7">${p.pontos}</div>
        </div>`;
    });
    return html;
  },

  _switchRank(tipo) {
    const nac = document.getElementById('rank-list-nacional');
    const reg = document.getElementById('rank-list-regional');
    const btnNac = document.getElementById('tab-rank-nac');
    const btnReg = document.getElementById('tab-rank-reg');
    if (!nac || !reg) return;
    if (tipo === 'nacional') {
      nac.style.display = 'block'; reg.style.display = 'none';
      btnNac.style.background = '#4f8ef7'; btnNac.style.color = '#fff';
      btnReg.style.background = 'transparent'; btnReg.style.color = '#a0aec0';
    } else {
      nac.style.display = 'none'; reg.style.display = 'block';
      btnReg.style.background = '#4f8ef7'; btnReg.style.color = '#fff';
      btnNac.style.background = 'transparent'; btnNac.style.color = '#a0aec0';
    }
  }
};
