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
    { id: 'SEM_CANCELAMENTO_MES', label: 'Mes Perfeito', icon: '🏆', niveis: [
        { label:'1 mes',  cor:'#cd7f32', raridade:'Bronze'   },
        { label:'3 meses',cor:'#a0aec0', raridade:'Prata'    },
        { label:'6 meses',cor:'#f6ad55', raridade:'Ouro'     },
        { label:'1 ano',  cor:'#b794f4', raridade:'Ametista' },
    ]},
    { id: 'MADRUGADOR',      label: 'Madrugador', icon: '🚀', niveis: [{ label:'Check-in antes das 7h', cor:'#63b3ed', raridade:'Especial' }] },
    { id: 'PRIMEIRO_CHECKIN',label: 'Estreante',  icon: '🌟', niveis: [{ label:'Primeiro check-in',     cor:'#ffd700', raridade:'Marco'    }] },
    { id: 'ACADEMY_BASICO',        label: 'Academy Basico',        icon: '🎓', niveis: [{ label:'Basico concluido',        cor:'#63b3ed', raridade:'Bronze'   }] },
    { id: 'ACADEMY_INTERMEDIARIO', label: 'Academy Intermediario', icon: '🏅', niveis: [{ label:'Intermediario concluido', cor:'#f6ad55', raridade:'Prata'    }] },
    { id: 'ACADEMY_AVANCADO',      label: 'Academy Avancado',      icon: '🚀', niveis: [{ label:'Avancado concluido',      cor:'#68d391', raridade:'Ouro'     }] },
    { id: 'ACADEMY_ESPECIALISTA',  label: 'Academy Especialista',  icon: '🔬', niveis: [{ label:'Especialista concluido',  cor:'#b794f4', raridade:'Safira'   }] },
    { id: 'ACADEMY_MASTER',        label: 'Academy Master',        icon: '👑', niveis: [{ label:'Master concluido',        cor:'#ffd700', raridade:'Lendario' }] },
    { id: 'INDICACAO', label: 'Indicacoes', icon: '🤝', niveis: [
        { label:'1 indicacao',   cor:'#cd7f32', raridade:'Bronze'    },
        { label:'3 indicacoes',  cor:'#a0aec0', raridade:'Prata'     },
        { label:'5 indicacoes',  cor:'#f6ad55', raridade:'Ouro'      },
        { label:'10 indicacoes', cor:'#63b3ed', raridade:'Safira'    },
        { label:'20 indicacoes', cor:'#68d391', raridade:'Esmeralda' },
    ]},
  ],

  _MESES:   ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  _COR_MES: ['#63b3ed','#68d391','#f6ad55','#fc8181','#b794f4','#fbd38d','#4299e1','#f687b3','#9f7aea','#ed8936','#48bb78','#e53e3e'],

  async render() {
    document.getElementById('app').innerHTML =
      '<div style="min-height:100dvh;background:#1a1a2e;color:#eaf0fb;font-family:-apple-system,sans-serif;padding-bottom:80px">'
      + '<div style="background:#16213e;border-bottom:1px solid #2a3a55;padding:14px 16px;position:sticky;top:0;z-index:50">'
      + '<div style="font-size:17px;font-weight:700">🏆 Ranking & Badges</div></div>'
      + '<div style="padding:16px" id="ranking-content"><div style="text-align:center;padding:40px;color:#a0aec0">Carregando...</div></div>'
      + ui.bottomNav("ranking")
      + '</div>';

    try {
      var results = await Promise.all([
        api.get('GET_RANKING_SEMANAL'),
        api.get('GET_BADGES')
      ]);
      var rankRes = results[0], badgeRes = results[1];
      var el      = document.getElementById('ranking-content');
      var eu      = state.get('promotor');
      var score   = eu ? (eu.score_operacional || 0) : 0;
      var streak  = eu ? (eu.streak_dias || 0) : 0;
      var badges  = badgeRes && badgeRes.badges || [];
      var self    = ranking;
      
      // Meu rank atual (usando o que o servidor calculou)
      var meuRank = rankRes.meuNacional;
      var pos     = meuRank ? meuRank.posicao : '-';
      var ganho   = meuRank ? meuRank.pontos : 0;

      // Score Header
      var html =
        '<div style="background:linear-gradient(135deg,#1e3a5f,#16213e);border:1px solid #2a3a55;border-radius:16px;padding:20px;margin-bottom:16px">'
        + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;margin-bottom:12px">'
        + '<div style="background:rgba(246,173,85,0.1);border-radius:10px;padding:10px"><div style="font-size:26px;font-weight:800;color:#f6ad55">' + score + '</div><div style="font-size:10px;color:#a0aec0">TOTAL</div></div>'
        + '<div style="background:rgba(104,211,145,0.1);border-radius:10px;padding:10px"><div style="font-size:26px;font-weight:800;color:#68d391">+' + ganho + '</div><div style="font-size:10px;color:#a0aec0">SEMANA</div></div>'
        + '<div style="background:rgba(99,179,237,0.1);border-radius:10px;padding:10px"><div style="font-size:26px;font-weight:800;color:#63b3ed">' + pos + 'º</div><div style="font-size:10px;color:#a0aec0">NACIONAL</div></div>'
        + '</div>'
        + (streak >= 3 ? '<div style="text-align:center"><span style="display:inline-flex;align-items:center;gap:6px;background:rgba(246,173,85,0.15);border:1px solid rgba(246,173,85,0.3);border-radius:20px;padding:4px 14px"><span>🔥</span><span style="font-size:13px;font-weight:700;color:#f6ad55">' + streak + ' dias</span></span></div>' : '')
        + '</div>';

      // Tabs de Ranking
      html += '<div style="background:#16213e;border-radius:12px;padding:4px;display:flex;margin-bottom:12px">'
        + '<button id="tab-rank-nac" onclick="ranking._switchRank(\'nacional\')" style="flex:1;background:#4f8ef7;color:#fff;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Nacional</button>'
        + '<button id="tab-rank-reg" onclick="ranking._switchRank(\'regional\')" style="flex:1;background:transparent;color:#a0aec0;border:none;border-radius:10px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">Minha Cidade</button>'
        + '</div>';

      // Containers de Ranking
      html += '<div id="rank-list-nacional">' + this._renderLista(rankRes.nacional, eu) + '</div>';
      html += '<div id="rank-list-regional" style="display:none">' + this._renderLista(rankRes.regional, eu, rankRes.cidade) + '</div>';

      // Separador
      html += '<div style="height:24px"></div>';

      // Conquistas
      html += '<div style="font-size:11px;color:#a0aec0;font-weight:700;letter-spacing:1px;margin-bottom:10px">MINHAS CONQUISTAS</div>';
      self._BADGES_DEF.forEach(function(def) {
        var conquistadasDef = badges.filter(function(b){ return b.tipo && b.tipo.startsWith(def.id); });
        var nivelAtingido   = conquistadasDef.length;
        var nivelAtual      = nivelAtingido > 0 ? def.niveis[nivelAtingido-1] : null;
        var proxNivel       = nivelAtingido < def.niveis.length ? def.niveis[nivelAtingido] : null;
        var cor             = nivelAtual ? nivelAtual.cor : '#4a5568';
        var opacity         = nivelAtingido > 0 ? '1' : '0.35';
        html += '<div style="background:#1e2a45;border:1px solid ' + cor + '44;border-radius:12px;padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px;opacity:' + opacity + '">'
          + '<div style="font-size:30px">' + def.icon + '</div>'
          + '<div style="flex:1">'
          + '<div style="font-size:13px;font-weight:700;color:#eaf0fb">' + def.label
          + (nivelAtual ? ' <span style="font-size:10px;padding:1px 6px;border-radius:8px;background:' + cor + '33;color:' + cor + '">' + nivelAtual.raridade + '</span>' : '') + '</div>'
          + '<div style="font-size:11px;color:#718096;margin-top:2px">' + (nivelAtual ? nivelAtual.label + ' conquistado' : 'Nao conquistado') + '</div>'
          + (proxNivel ? '<div style="font-size:10px;color:#63b3ed;margin-top:2px">Proximo: ' + proxNivel.label + ' (' + proxNivel.raridade + ')</div>' : (nivelAtingido >= def.niveis.length ? '<div style="font-size:10px;color:#ffd700">Nivel maximo!</div>' : ''))
          + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">'
          + def.niveis.map(function(_, i){ return '<div style="width:8px;height:8px;border-radius:50%;background:' + (i < nivelAtingido ? def.niveis[i].cor : '#2a3a55') + '"></div>'; }).join('')
          + '</div></div>';
      });

      el.innerHTML = html;

    } catch(e) {
      var el = document.getElementById('ranking-content');
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px">Erro ao carregar ranking</div>';
      console.error('[ranking]', e);
    }
  },

  _renderLista(lista, eu, cidade) {
    var html = '';
    if (cidade) html += '<div style="font-size:10px;color:#718096;margin-bottom:8px;text-align:center">Exibindo promotores de <b>' + cidade + '</b></div>';
    
    if (!lista || lista.length === 0) {
      return html + '<div style="text-align:center;padding:20px;color:#4a5568">Nenhum dado nesta categoria</div>';
    }

    lista.forEach(function(p, i) {
      var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'º';
      var isMe  = eu && p.user_id === eu.user_id;
      var cor   = i===0?'#f6ad55':i===1?'#a0aec0':i===2?'#cd7f32':'#4f8ef7';
      html += '<div style="background:' + (isMe?'rgba(79,142,247,0.1)':'#1e2a45') + ';border:1px solid ' + (isMe?'#4f8ef7':'#2a3a55') + ';border-radius:12px;padding:12px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px">'
        + '<div style="font-size:22px;width:32px;text-align:center">' + medal + '</div>'
        + '<div style="flex:1">'
        + '<div style="font-size:13px;font-weight:700;color:' + (isMe?'#4f8ef7':'#eaf0fb') + '">' + p.nome + (isMe?' ✦':'') + '</div>'
        + (p.cidade && !cidade ? '<div style="font-size:10px;color:#718096">' + p.cidade + '</div>' : '')
        + '</div>'
        + '<div style="font-size:18px;font-weight:800;color:' + cor + '">' + p.pontos + '</div></div>';
    });
    return html;
  },

  _switchRank(tipo) {
    const nac = document.getElementById('rank-list-nacional');
    const reg = document.getElementById('rank-list-regional');
    const btnNac = document.getElementById('tab-rank-nac');
    const btnReg = document.getElementById('tab-rank-reg');

    if (tipo === 'nacional') {
      nac.style.display = 'block';
      reg.style.display = 'none';
      btnNac.style.background = '#4f8ef7'; btnNac.style.color = '#fff';
      btnReg.style.background = 'transparent'; btnReg.style.color = '#a0aec0';
    } else {
      nac.style.display = 'none';
      reg.style.display = 'block';
      btnReg.style.background = '#4f8ef7'; btnReg.style.color = '#fff';
      btnNac.style.background = 'transparent'; btnNac.style.color = '#a0aec0';
    }
  },

      // Pontos
      html += '<div style="background:#1e2a45;border:1px solid #2a3a55;border-radius:12px;padding:16px;margin-top:8px">'
        + '<div style="font-size:12px;font-weight:700;color:#a0aec0;letter-spacing:1px;margin-bottom:12px">COMO GANHAR PONTOS</div>';
      [['✅ Check-in pontual','+ 10'],['✅ Check-in com atraso','+ 5'],['🏁 Checkout','+ 5'],
       ['🔥 Streak bonus (a cada 5 dias)','+ 25'],['❌ Cancelamento','- 20'],['📵 Checkout sem GPS','- 5']
      ].forEach(function(row) {
        html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a3a55">'
          + '<span style="font-size:13px;color:#eaf0fb">' + row[0] + '</span>'
          + '<span style="font-size:13px;font-weight:700;color:' + (row[1].includes('-')?'#fc8181':'#68d391') + '">' + row[1] + '</span></div>';
      });
      html += '</div>';

      el.innerHTML = html;

    } catch(e) {
      var el = document.getElementById('ranking-content');
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#e74c3c;font-size:13px">Erro ao carregar ranking</div>';
      console.error('[ranking]', e);
    }
  }
};
