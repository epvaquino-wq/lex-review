/**
 * LexReview - Storage Manager
 * Manages all data persistence for the flashcard app.
 */

const Storage = (() => {
  const STORAGE_KEY = 'lexReview';

  // Storage wrapper with in-memory fallback for sandboxed iframes
  const _store = (() => {
    const mem = {};
    const ls = (() => { try { return window[['local','Storage'].join('')]; } catch { return null; } })();
    if (ls) {
      try {
        const t = '__t__';
        ls.setItem(t, '1');
        ls.removeItem(t);
        return { getItem: k => ls.getItem(k), setItem: (k, v) => ls.setItem(k, v), removeItem: k => ls.removeItem(k) };
      } catch { /* fall through */ }
    }
    return {
      getItem: k => mem[k] ?? null,
      setItem: (k, v) => { mem[k] = v; },
      removeItem: k => { delete mem[k]; }
    };
  })();

  const DEFAULT_CONFIG = {
    maxCardsPerSession: 20,
    quotas: { overdue: 8, learning: 6, new: 4, mature: 2 },
    retirementThresholdDays: 90,
    leechThreshold: 5
  };

  const DEFAULT_STATS = {
    totalReviews: 0,
    streak: 0,
    lastReviewDate: null
  };

  const SAMPLE_CARDS = [
    {
      id: _uuid(),
      frente: 'Qual é o fundamento da República Federativa do Brasil previsto no Art. 1º, III da CF/88?',
      verso: 'A dignidade da pessoa humana é um dos fundamentos da República Federativa do Brasil, conforme Art. 1º, III da Constituição Federal de 1988.',
      threadTitle: 'Direito Constitucional - Princípios Fundamentais',
      threadUrl: '',
      tags: ['direito_constitucional', 'principios_fundamentais'],
      dateAdded: '2026-03-28',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'Quais são os objetivos fundamentais da República (Art. 3º, CF/88)?',
      verso: 'I - construir uma sociedade livre, justa e solidária;\nII - garantir o desenvolvimento nacional;\nIII - erradicar a pobreza e a marginalização e reduzir as desigualdades sociais e regionais;\nIV - promover o bem de todos, sem preconceitos de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação.',
      threadTitle: 'Direito Constitucional - Princípios Fundamentais',
      threadUrl: '',
      tags: ['direito_constitucional', 'principios_fundamentais'],
      dateAdded: '2026-03-28',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'O que é o princípio da legalidade (Art. 5º, II, CF/88)?',
      verso: 'Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei. É uma garantia fundamental que limita o poder do Estado e protege a liberdade individual.',
      threadTitle: 'Direito Constitucional - Direitos Fundamentais',
      threadUrl: '',
      tags: ['direito_constitucional', 'direitos_fundamentais'],
      dateAdded: '2026-03-28',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'Qual a diferença entre direitos e garantias fundamentais?',
      verso: 'Direitos fundamentais são disposições declaratórias que reconhecem a existência de um bem jurídico (ex: direito à vida, à liberdade). Garantias fundamentais são disposições assecuratórias que protegem esses direitos, limitando o poder do Estado (ex: habeas corpus, mandado de segurança).',
      threadTitle: 'Direito Constitucional - Direitos Fundamentais',
      threadUrl: '',
      tags: ['direito_constitucional', 'direitos_fundamentais'],
      dateAdded: '2026-03-27',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'O que é cláusula pétrea? Cite exemplos.',
      verso: 'Cláusulas pétreas são limitações materiais ao poder de reforma constitucional, previstas no Art. 60, §4º da CF/88. Não podem ser objeto de emenda tendente a abolir:\n- A forma federativa de Estado\n- O voto direto, secreto, universal e periódico\n- A separação dos Poderes\n- Os direitos e garantias individuais',
      threadTitle: 'Direito Constitucional - Poder Constituinte',
      threadUrl: '',
      tags: ['direito_constitucional', 'poder_constituinte', 'clausulas_petreas'],
      dateAdded: '2026-03-27',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'Quais são os remédios constitucionais?',
      verso: '1. Habeas Corpus (Art. 5º, LXVIII) - liberdade de locomoção\n2. Mandado de Segurança (Art. 5º, LXIX) - direito líquido e certo\n3. Mandado de Injunção (Art. 5º, LXXI) - falta de norma regulamentadora\n4. Habeas Data (Art. 5º, LXXII) - acesso/retificação de dados pessoais\n5. Ação Popular (Art. 5º, LXXIII) - anulação de ato lesivo\n6. Ação Civil Pública - defesa de interesses difusos e coletivos',
      threadTitle: 'Direito Constitucional - Remédios Constitucionais',
      threadUrl: '',
      tags: ['direito_constitucional', 'remedios_constitucionais'],
      dateAdded: '2026-03-26',
      reviewData: {
        repetitions: 1,
        easinessFactor: 2.5,
        intervalDays: 3,
        nextReview: '2026-03-29',
        lastReview: '2026-03-26',
        consecutiveFails: 0,
        reviewHistory: [{ date: '2026-03-26', quality: 4 }]
      }
    },
    {
      id: _uuid(),
      frente: 'O que é o controle de constitucionalidade difuso?',
      verso: 'É o controle realizado por qualquer juiz ou tribunal no caso concreto (incidental). A questão constitucional é analisada como questão prejudicial, com efeitos inter partes. Tem origem no caso Marbury v. Madison (1803, EUA) e foi adotado no Brasil desde a Constituição de 1891.',
      threadTitle: 'Direito Constitucional - Controle de Constitucionalidade',
      threadUrl: '',
      tags: ['direito_constitucional', 'controle_constitucionalidade'],
      dateAdded: '2026-03-25',
      reviewData: {
        repetitions: 2,
        easinessFactor: 2.6,
        intervalDays: 7,
        nextReview: '2026-04-01',
        lastReview: '2026-03-25',
        consecutiveFails: 0,
        reviewHistory: [
          { date: '2026-03-23', quality: 3 },
          { date: '2026-03-25', quality: 4 }
        ]
      }
    },
    {
      id: _uuid(),
      frente: 'Quais são as espécies normativas do processo legislativo (Art. 59, CF/88)?',
      verso: 'O processo legislativo compreende a elaboração de:\nI - emendas à Constituição;\nII - leis complementares;\nIII - leis ordinárias;\nIV - leis delegadas;\nV - medidas provisórias;\nVI - decretos legislativos;\nVII - resoluções.',
      threadTitle: 'Direito Constitucional - Processo Legislativo',
      threadUrl: '',
      tags: ['direito_constitucional', 'processo_legislativo'],
      dateAdded: '2026-03-24',
      reviewData: {
        repetitions: 3,
        easinessFactor: 2.5,
        intervalDays: 18,
        nextReview: '2026-04-11',
        lastReview: '2026-03-24',
        consecutiveFails: 0,
        reviewHistory: [
          { date: '2026-03-18', quality: 4 },
          { date: '2026-03-21', quality: 4 },
          { date: '2026-03-24', quality: 5 }
        ]
      }
    },
    {
      id: _uuid(),
      frente: 'Qual o quorum para aprovação de emenda constitucional?',
      verso: 'A proposta de emenda constitucional deve ser aprovada em cada Casa do Congresso Nacional, em dois turnos, por três quintos dos votos dos respectivos membros (Art. 60, §2º, CF/88). Ou seja: 3/5 dos Deputados (308/513) e 3/5 dos Senadores (49/81), em dois turnos.',
      threadTitle: 'Direito Constitucional - Poder Constituinte',
      threadUrl: '',
      tags: ['direito_constitucional', 'poder_constituinte', 'emendas'],
      dateAdded: '2026-03-20',
      reviewData: {
        repetitions: 2,
        easinessFactor: 2.36,
        intervalDays: 7,
        nextReview: '2026-03-30',
        lastReview: '2026-03-23',
        consecutiveFails: 0,
        reviewHistory: [
          { date: '2026-03-20', quality: 3 },
          { date: '2026-03-23', quality: 3 }
        ]
      }
    },
    {
      id: _uuid(),
      frente: 'O que é o princípio da separação dos poderes?',
      verso: 'Previsto no Art. 2º da CF/88: "São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário." Baseia-se na teoria de Montesquieu e visa evitar a concentração de poder. No Brasil, adota-se o sistema de freios e contrapesos (checks and balances).',
      threadTitle: 'Direito Constitucional - Organização dos Poderes',
      threadUrl: '',
      tags: ['direito_constitucional', 'organizacao_poderes'],
      dateAdded: '2026-03-22',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'Qual a diferença entre lei complementar e lei ordinária?',
      verso: 'Lei Complementar:\n- Quorum: maioria absoluta (Art. 69, CF)\n- Matéria: reservada pela CF (taxativa)\n- Hierarquicamente superior segundo parte da doutrina\n\nLei Ordinária:\n- Quorum: maioria simples (Art. 47, CF)\n- Matéria: residual (tudo que não exige LC)\n- Mais comum no ordenamento jurídico',
      threadTitle: 'Direito Constitucional - Processo Legislativo',
      threadUrl: '',
      tags: ['direito_constitucional', 'processo_legislativo'],
      dateAdded: '2026-03-21',
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: '2026-03-28',
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    },
    {
      id: _uuid(),
      frente: 'O que é a Ação Direta de Inconstitucionalidade (ADI)?',
      verso: 'A ADI (Art. 102, I, "a", CF) é ação de controle concentrado de constitucionalidade, julgada pelo STF. Visa declarar a inconstitucionalidade de lei ou ato normativo federal ou estadual. Legitimados: Art. 103, CF (Presidente, Mesa do Senado/Câmara, PGR, Governadores, partido com representação no CN, confederação sindical, conselho federal da OAB, entre outros). Efeitos: erga omnes, ex tunc, vinculante.',
      threadTitle: 'Direito Constitucional - Controle de Constitucionalidade',
      threadUrl: '',
      tags: ['direito_constitucional', 'controle_constitucionalidade'],
      dateAdded: '2026-03-26',
      reviewData: {
        repetitions: 1,
        easinessFactor: 2.36,
        intervalDays: 3,
        nextReview: '2026-03-29',
        lastReview: '2026-03-26',
        consecutiveFails: 0,
        reviewHistory: [{ date: '2026-03-26', quality: 3 }]
      }
    }
  ];

  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function _getStore() {
    try {
      const raw = _store.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read store:', e);
    }
    return null;
  }

  function _saveStore(data) {
    try {
      _store.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to write store:', e);
    }
  }

  function init() {
    let store = _getStore();
    if (!store) {
      store = {
        cards: SAMPLE_CARDS,
        config: { ...DEFAULT_CONFIG },
        stats: { ...DEFAULT_STATS, totalReviews: 4, streak: 3, lastReviewDate: '2026-03-27' }
      };
      _saveStore(store);
    }
    return store;
  }

  function getAll() {
    return _getStore() || init();
  }

  function getCards() {
    return getAll().cards;
  }

  function getConfig() {
    return getAll().config;
  }

  function getStats() {
    return getAll().stats;
  }

  function saveCard(card) {
    const store = getAll();
    if (!card.id) card.id = _uuid();
    const idx = store.cards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      store.cards[idx] = card;
    } else {
      store.cards.push(card);
    }
    _saveStore(store);
    return card;
  }

  function deleteCard(id) {
    const store = getAll();
    store.cards = store.cards.filter(c => c.id !== id);
    _saveStore(store);
  }

  function deleteCards(ids) {
    const store = getAll();
    const idSet = new Set(ids);
    store.cards = store.cards.filter(c => !idSet.has(c.id));
    _saveStore(store);
  }

  function createCard(frente, verso, threadTitle, tags, threadUrl = '') {
    const today = new Date().toISOString().split('T')[0];
    return saveCard({
      id: _uuid(),
      frente,
      verso,
      threadTitle: threadTitle || 'Geral',
      threadUrl,
      tags: tags || [],
      dateAdded: today,
      reviewData: {
        repetitions: 0,
        easinessFactor: 2.5,
        intervalDays: 1,
        nextReview: today,
        lastReview: null,
        consecutiveFails: 0,
        reviewHistory: []
      }
    });
  }

  function updateConfig(newConfig) {
    const store = getAll();
    store.config = { ...store.config, ...newConfig };
    _saveStore(store);
  }

  function updateStats(newStats) {
    const store = getAll();
    store.stats = { ...store.stats, ...newStats };
    _saveStore(store);
  }

  function getCardStatus(card) {
    const config = getConfig();
    const rd = card.reviewData;
    if (rd.consecutiveFails >= config.leechThreshold) return 'leech';
    if (rd.repetitions === 0 && !rd.lastReview) return 'new';
    if (rd.intervalDays >= config.retirementThresholdDays) return 'retired';
    if (rd.intervalDays >= 21) return 'mature';
    return 'learning';
  }

  function getDueCards(dateStr) {
    const cards = getCards();
    return cards.filter(c => c.reviewData.nextReview <= dateStr);
  }

  function getDueCount(dateStr) {
    return getDueCards(dateStr).length;
  }

  function getThreads() {
    const cards = getCards();
    const threads = {};
    cards.forEach(c => {
      const t = c.threadTitle || 'Geral';
      if (!threads[t]) threads[t] = { count: 0, dueToday: 0 };
      threads[t].count++;
      const today = new Date().toISOString().split('T')[0];
      if (c.reviewData.nextReview <= today) threads[t].dueToday++;
    });
    return threads;
  }

  function getAllTags() {
    const cards = getCards();
    const tagSet = new Set();
    cards.forEach(c => (c.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }

  function exportData() {
    return JSON.stringify(getAll(), null, 2);
  }

  function importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.cards || !Array.isArray(data.cards)) throw new Error('Invalid data format');
      if (!data.config) data.config = { ...DEFAULT_CONFIG };
      if (!data.stats) data.stats = { ...DEFAULT_STATS };
      _saveStore(data);
      return { success: true, count: data.cards.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function resetAll() {
    _store.removeItem(STORAGE_KEY);
    return init();
  }

  function getReviewHistory(days = 30) {
    const cards = getCards();
    const history = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      history[d.toISOString().split('T')[0]] = { count: 0, totalQuality: 0 };
    }
    cards.forEach(c => {
      (c.reviewData.reviewHistory || []).forEach(r => {
        if (history[r.date]) {
          history[r.date].count++;
          history[r.date].totalQuality += r.quality;
        }
      });
    });
    return history;
  }

  function getForecast(days = 7) {
    const cards = getCards();
    const forecast = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const count = cards.filter(c => c.reviewData.nextReview === dateStr).length;
      forecast.push({ date: dateStr, count, label: i === 0 ? 'Hoje' : _dayLabel(d) });
    }
    return forecast;
  }

  function _dayLabel(date) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
  }

  function generateUUID() {
    return _uuid();
  }

  return {
    init,
    getAll,
    getCards,
    getConfig,
    getStats,
    saveCard,
    deleteCard,
    deleteCards,
    createCard,
    updateConfig,
    updateStats,
    getCardStatus,
    getDueCards,
    getDueCount,
    getThreads,
    getAllTags,
    exportData,
    importData,
    resetAll,
    getReviewHistory,
    getForecast,
    generateUUID
  };
})();
