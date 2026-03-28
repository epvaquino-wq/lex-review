/**
 * LexReview - Main Application
 * All view rendering and UI logic for the flashcard SPA.
 */

const App = (() => {
  let reviewSession = null;
  let currentEditId = null;
  let selectedCards = new Set();
  let browseSort = { field: 'nextReview', dir: 'asc' };
  let browseFilters = { search: '', status: '', thread: '', tag: '' };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

  // ── Helpers ──
  function formatDate(d) {
    if (!d) return '—';
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function daysDiff(d1, d2) {
    return Math.round((new Date(d1) - new Date(d2)) / 86400000);
  }

  function today() {
    return new Date().toISOString().split('T')[0];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toast(msg, type = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function showModal(title, bodyHtml, actions) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${title}</h3>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-actions" id="modal-actions"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const actionsEl = overlay.querySelector('#modal-actions');
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.className = a.class || 'btn btn-secondary';
      btn.textContent = a.label;
      btn.onclick = () => {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
        if (a.action) a.action();
      };
      actionsEl.appendChild(btn);
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
      }
    });
  }

  function updateNavBadge() {
    const due = Storage.getDueCount(today());
    const badge = document.getElementById('nav-review-badge');
    if (badge) {
      badge.textContent = due;
      badge.style.display = due > 0 ? 'inline-flex' : 'none';
    }
  }

  function intervalLabel(days) {
    if (days < 1) return '< 1 dia';
    if (days === 1) return '1 dia';
    if (days < 30) return `${days} dias`;
    if (days < 365) return `${Math.round(days / 30)} meses`;
    return `${Math.round(days / 365)} anos`;
  }

  // ── DASHBOARD ──
  function renderDashboard() {
    const main = $('#main-content');
    const cards = Storage.getCards();
    const config = Storage.getConfig();
    const stats = Storage.getStats();
    const catStats = SM2.getCategoryStats(cards, config);
    const dueToday = Storage.getDueCount(today());
    const forecast = Storage.getForecast(7);
    const threads = Storage.getThreads();

    const maxForecast = Math.max(...forecast.map(f => f.count), 1);

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Painel</h1>
        <p class="page-subtitle">Visão geral dos seus estudos</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total de Cartões</span>
          <span class="stat-value">${cards.length}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Para Hoje</span>
          <span class="stat-value" style="color: ${dueToday > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)'}">${dueToday}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Sequência</span>
          <span class="stat-value">${stats.streak} <span style="font-size: var(--text-sm); font-weight: 400">dias</span></span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Revisões Totais</span>
          <span class="stat-value">${stats.totalReviews}</span>
        </div>
      </div>

      <div class="quick-actions">
        <button class="quick-action-btn" onclick="App.startReview()">
          <i data-lucide="play-circle"></i>
          Iniciar Revisão${dueToday > 0 ? ` (${dueToday})` : ''}
        </button>
        <button class="quick-action-btn" onclick="Router.navigate('add')">
          <i data-lucide="plus-circle"></i>
          Adicionar Cartões
        </button>
        <button class="quick-action-btn" onclick="App.exportData()">
          <i data-lucide="download"></i>
          Exportar Dados
        </button>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Previsão — 7 Dias</span>
          </div>
          <div class="forecast-chart">
            ${forecast.map((f, i) => `
              <div class="forecast-bar-wrapper">
                <div class="forecast-bar-count">${f.count || ''}</div>
                <div class="forecast-bar-container">
                  <div class="forecast-bar ${i === 0 ? 'today' : ''}" style="height: ${f.count ? Math.max(10, (f.count / maxForecast) * 100) : 4}%"></div>
                </div>
                <div class="forecast-bar-label">${f.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Categorias</span>
          </div>
          <div class="category-stats">
            <div class="category-stat">
              <span class="category-dot" style="background: var(--color-new)"></span>
              <span>Novos: <strong>${catStats.new}</strong></span>
            </div>
            <div class="category-stat">
              <span class="category-dot" style="background: var(--color-learning)"></span>
              <span>Aprendendo: <strong>${catStats.learning}</strong></span>
            </div>
            <div class="category-stat">
              <span class="category-dot" style="background: var(--color-mature)"></span>
              <span>Maduros: <strong>${catStats.mature}</strong></span>
            </div>
            <div class="category-stat">
              <span class="category-dot" style="background: var(--color-retired)"></span>
              <span>Aposentados: <strong>${catStats.retired}</strong></span>
            </div>
            <div class="category-stat">
              <span class="category-dot" style="background: var(--color-leech)"></span>
              <span>Sanguessugas: <strong>${catStats.leech}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-6">
        <div class="card-header">
          <span class="card-title">Tópicos</span>
        </div>
        <div class="threads-list">
          ${Object.entries(threads).map(([name, data]) => `
            <div class="thread-item">
              <span class="thread-name">${escapeHtml(name)}</span>
              <div class="thread-counts">
                <span>${data.count} ${data.count === 1 ? 'cartão' : 'cartões'}</span>
                ${data.dueToday > 0 ? `<span class="thread-due">${data.dueToday} para hoje</span>` : ''}
              </div>
            </div>
          `).join('') || '<div class="empty-state"><p>Nenhum tópico ainda</p></div>'}
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  // ── REVIEW SESSION ──
  function startReview() {
    const cards = Storage.getCards();
    const config = Storage.getConfig();
    const queue = SM2.buildSessionQueue(cards, config);

    if (queue.length === 0) {
      toast('Nenhum cartão para revisar hoje! 🎉');
      return;
    }

    reviewSession = {
      queue,
      currentIndex: 0,
      results: [],
      startTime: Date.now()
    };

    Router.navigate('review');
  }

  function renderReview() {
    const main = $('#main-content');

    // Auto-start session if navigating directly to review
    if (!reviewSession) {
      const cards = Storage.getCards();
      const config = Storage.getConfig();
      const queue = SM2.buildSessionQueue(cards, config);
      if (queue.length > 0) {
        reviewSession = {
          queue,
          currentIndex: 0,
          results: [],
          startTime: Date.now()
        };
      }
    }

    if (!reviewSession || reviewSession.queue.length === 0) {
      main.innerHTML = `
        <div class="review-container">
          <div class="empty-state">
            <div class="empty-state-icon">📚</div>
            <h3>Nenhum cartão para revisar</h3>
            <p>Todos os cartões estão em dia! Volte mais tarde ou adicione novos cartões.</p>
            <div class="flex gap-3" style="justify-content: center">
              <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Voltar ao Painel</button>
              <button class="btn btn-secondary" onclick="Router.navigate('add')">Adicionar Cartões</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (reviewSession.currentIndex >= reviewSession.queue.length) {
      renderSessionComplete();
      return;
    }

    const card = reviewSession.queue[reviewSession.currentIndex];
    const status = Storage.getCardStatus(card);
    const config = Storage.getConfig();
    const isLeech = (card.reviewData.consecutiveFails || 0) >= config.leechThreshold;
    const progress = reviewSession.currentIndex / reviewSession.queue.length;

    main.innerHTML = `
      <div class="review-container">
        <div class="review-progress">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${progress * 100}%"></div>
          </div>
          <span class="progress-text">${reviewSession.currentIndex + 1} / ${reviewSession.queue.length}</span>
        </div>

        ${isLeech ? `
          <div class="leech-warning">
            <i data-lucide="alert-triangle"></i>
            Atenção: este cartão foi esquecido ${card.reviewData.consecutiveFails} vezes consecutivas (sanguessuga)
          </div>
        ` : ''}

        <div class="flashcard-container">
          <div class="flashcard" id="flashcard" onclick="App.flipCard()">
            <div class="flashcard-face flashcard-front">
              <span class="flashcard-label">Pergunta</span>
              <div class="flashcard-question">${escapeHtml(card.frente)}</div>
              <span class="flashcard-hint">Clique para revelar a resposta</span>
            </div>
            <div class="flashcard-face flashcard-back">
              <span class="flashcard-label">Resposta</span>
              <div class="flashcard-answer">${escapeHtml(card.verso)}</div>
              <div class="flashcard-meta">
                <span class="flashcard-meta-item">
                  <i data-lucide="folder" style="width:12px;height:12px"></i>
                  ${escapeHtml(card.threadTitle)}
                </span>
                <span class="flashcard-meta-item">
                  <i data-lucide="calendar" style="width:12px;height:12px"></i>
                  ${card.reviewData.lastReview ? formatDate(card.reviewData.lastReview) : 'Nunca revisado'}
                </span>
                <span class="flashcard-meta-item">
                  <i data-lucide="clock" style="width:12px;height:12px"></i>
                  Intervalo: ${intervalLabel(card.reviewData.intervalDays)}
                </span>
                <span class="badge badge-${status}">${status === 'new' ? 'Novo' : status === 'learning' ? 'Aprendendo' : status === 'mature' ? 'Maduro' : status === 'leech' ? 'Sanguessuga' : status}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rating-buttons" id="rating-buttons" style="display: none">
          <button class="rating-btn forgot" onclick="App.rateCard(0)">
            <span class="rating-btn-label">Esqueci</span>
            <span class="rating-btn-interval">1 dia</span>
          </button>
          <button class="rating-btn hard" onclick="App.rateCard(3)">
            <span class="rating-btn-label">Difícil</span>
            <span class="rating-btn-interval">${intervalLabel(previewInterval(card, 3))}</span>
          </button>
          <button class="rating-btn good" onclick="App.rateCard(4)">
            <span class="rating-btn-label">Bom</span>
            <span class="rating-btn-interval">${intervalLabel(previewInterval(card, 4))}</span>
          </button>
          <button class="rating-btn easy" onclick="App.rateCard(5)">
            <span class="rating-btn-label">Fácil</span>
            <span class="rating-btn-interval">${intervalLabel(previewInterval(card, 5))}</span>
          </button>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  function previewInterval(card, quality) {
    const result = SM2.calculate(card.reviewData, quality);
    return result.intervalDays;
  }

  function flipCard() {
    const fc = $('#flashcard');
    if (!fc) return;
    fc.classList.toggle('flipped');
    if (fc.classList.contains('flipped')) {
      const btns = $('#rating-buttons');
      if (btns) btns.style.display = 'grid';
    }
  }

  function rateCard(quality) {
    if (!reviewSession) return;
    const card = reviewSession.queue[reviewSession.currentIndex];
    const newReviewData = SM2.calculate(card.reviewData, quality);
    card.reviewData = newReviewData;
    Storage.saveCard(card);

    // Update stats
    const stats = Storage.getStats();
    stats.totalReviews++;
    const todayStr = today();
    if (stats.lastReviewDate !== todayStr) {
      const lastDate = stats.lastReviewDate;
      if (lastDate) {
        const diff = daysDiff(todayStr, lastDate);
        stats.streak = diff === 1 ? stats.streak + 1 : 1;
      } else {
        stats.streak = 1;
      }
      stats.lastReviewDate = todayStr;
    }
    Storage.updateStats(stats);

    reviewSession.results.push({ cardId: card.id, quality });
    reviewSession.currentIndex++;
    updateNavBadge();
    renderReview();
  }

  function renderSessionComplete() {
    const main = $('#main-content');
    const results = reviewSession.results;
    const elapsed = Math.round((Date.now() - reviewSession.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    const forgot = results.filter(r => r.quality < 3).length;
    const hard = results.filter(r => r.quality === 3).length;
    const good = results.filter(r => r.quality === 4).length;
    const easy = results.filter(r => r.quality === 5).length;
    const avgQuality = results.length > 0 ? (results.reduce((s, r) => s + r.quality, 0) / results.length).toFixed(1) : 0;

    main.innerHTML = `
      <div class="review-container">
        <div class="session-complete">
          <div class="session-complete-icon">✅</div>
          <h2>Sessão Concluída!</h2>
          <p>Parabéns! Você revisou ${results.length} cartões em ${minutes > 0 ? minutes + 'min ' : ''}${seconds}s.</p>

          <div class="session-summary">
            <div class="session-summary-item">
              <div class="session-summary-value">${results.length}</div>
              <div class="session-summary-label">Revisados</div>
            </div>
            <div class="session-summary-item">
              <div class="session-summary-value">${avgQuality}</div>
              <div class="session-summary-label">Qualidade Média</div>
            </div>
            <div class="session-summary-item">
              <div class="session-summary-value" style="color: var(--color-success)">${good + easy}</div>
              <div class="session-summary-label">Acertos</div>
            </div>
            <div class="session-summary-item">
              <div class="session-summary-value" style="color: var(--color-error)">${forgot}</div>
              <div class="session-summary-label">Esquecidos</div>
            </div>
          </div>

          <div class="flex gap-3 mt-6" style="justify-content: center">
            <button class="btn btn-primary" onclick="Router.navigate('dashboard')">Voltar ao Painel</button>
            <button class="btn btn-secondary" onclick="App.startReview()">Nova Sessão</button>
          </div>
        </div>
      </div>
    `;

    reviewSession = null;
  }

  // ── ADD CARDS ──
  function renderAdd() {
    const main = $('#main-content');
    const threads = Object.keys(Storage.getThreads());

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Adicionar Cartões</h1>
        <p class="page-subtitle">Crie novos cartões de estudo</p>
      </div>

      <div class="add-tabs">
        <button class="add-tab active" data-tab="manual" onclick="App.switchAddTab('manual')">Manual</button>
        <button class="add-tab" data-tab="paste" onclick="App.switchAddTab('paste')">Colar Texto</button>
        <button class="add-tab" data-tab="bulk" onclick="App.switchAddTab('bulk')">Importação em Massa</button>
      </div>

      <div id="add-tab-content">
        ${renderManualTab(threads)}
      </div>
    `;

    lucide.createIcons();
  }

  function renderManualTab(threads) {
    return `
      <div id="tab-manual">
        <form id="add-card-form" onsubmit="App.handleAddCard(event)">
          <div class="form-group">
            <label class="form-label">Pergunta (Frente)</label>
            <textarea class="form-textarea" id="card-frente" placeholder="Digite a pergunta..." required></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Resposta (Verso)</label>
            <textarea class="form-textarea" id="card-verso" placeholder="Digite a resposta..." required></textarea>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Tópico</label>
              <input class="form-input" id="card-thread" list="thread-list" placeholder="Ex: Direito Constitucional" />
              <datalist id="thread-list">
                ${(threads || []).map(t => `<option value="${escapeHtml(t)}">`).join('')}
              </datalist>
            </div>
            <div class="form-group">
              <label class="form-label">Tags</label>
              <input class="form-input" id="card-tags" placeholder="Ex: direito_civil, contratos" />
              <span class="form-help">Separadas por vírgula</span>
            </div>
          </div>
          <button type="submit" class="btn btn-primary">
            <i data-lucide="plus"></i>
            Adicionar Cartão
          </button>
        </form>
      </div>
    `;
  }

  function renderPasteTab() {
    const threads = Object.keys(Storage.getThreads());
    return `
      <div id="tab-paste">
        <div class="paste-layout">
          <div>
            <div class="form-group">
              <label class="form-label">Texto de Referência</label>
              <textarea class="form-textarea paste-text-area" id="paste-text" placeholder="Cole aqui o texto de referência (ex: resumo de um tópico, thread do Perplexity, artigo)..."></textarea>
            </div>
          </div>
          <div>
            <form onsubmit="App.handleAddCard(event)">
              <div class="form-group">
                <label class="form-label">Pergunta (Frente)</label>
                <textarea class="form-textarea" id="card-frente" placeholder="Crie uma pergunta baseada no texto..." required></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">Resposta (Verso)</label>
                <textarea class="form-textarea" id="card-verso" placeholder="Escreva a resposta..." required></textarea>
              </div>
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Tópico</label>
                  <input class="form-input" id="card-thread" list="thread-list-paste" placeholder="Ex: Direito Civil" />
                  <datalist id="thread-list-paste">
                    ${threads.map(t => `<option value="${escapeHtml(t)}">`).join('')}
                  </datalist>
                </div>
                <div class="form-group">
                  <label class="form-label">Tags</label>
                  <input class="form-input" id="card-tags" placeholder="tag1, tag2" />
                </div>
              </div>
              <button type="submit" class="btn btn-primary">
                <i data-lucide="plus"></i>
                Adicionar Cartão
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function renderBulkTab() {
    return `
      <div id="tab-bulk">
        <div class="form-group">
          <label class="form-label">JSON de Cartões</label>
          <textarea class="form-textarea" id="bulk-json" style="min-height:200px; font-family: monospace; font-size: var(--text-xs)" placeholder='[
  {
    "frente": "Pergunta aqui",
    "verso": "Resposta aqui",
    "tags": ["tag1", "tag2"],
    "threadTitle": "Tópico"
  }
]'></textarea>
          <span class="form-help">Cole um array JSON com objetos contendo "frente", "verso", e opcionalmente "tags" e "threadTitle".</span>
        </div>
        <button class="btn btn-primary" onclick="App.handleBulkAdd()">
          <i data-lucide="upload"></i>
          Importar Cartões
        </button>
      </div>
    `;
  }

  function switchAddTab(tab) {
    $$('.add-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const content = $('#add-tab-content');
    const threads = Object.keys(Storage.getThreads());

    switch (tab) {
      case 'manual':
        content.innerHTML = renderManualTab(threads);
        break;
      case 'paste':
        content.innerHTML = renderPasteTab();
        break;
      case 'bulk':
        content.innerHTML = renderBulkTab();
        break;
    }
    lucide.createIcons();
  }

  function handleAddCard(e) {
    e.preventDefault();
    const frente = $('#card-frente').value.trim();
    const verso = $('#card-verso').value.trim();
    const thread = ($('#card-thread') && $('#card-thread').value.trim()) || 'Geral';
    const tagsStr = ($('#card-tags') && $('#card-tags').value.trim()) || '';
    const tags = tagsStr ? tagsStr.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean) : [];

    if (!frente || !verso) {
      toast('Preencha pergunta e resposta', 'error');
      return;
    }

    Storage.createCard(frente, verso, thread, tags);
    toast('Cartão adicionado com sucesso!', 'success');
    updateNavBadge();

    // Clear form
    $('#card-frente').value = '';
    $('#card-verso').value = '';
    if ($('#card-tags')) $('#card-tags').value = '';
    $('#card-frente').focus();
  }

  function handleBulkAdd() {
    const json = $('#bulk-json').value.trim();
    if (!json) {
      toast('Cole o JSON dos cartões', 'error');
      return;
    }
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) throw new Error('Not an array');
      let count = 0;
      arr.forEach(item => {
        if (item.frente && item.verso) {
          Storage.createCard(
            item.frente,
            item.verso,
            item.threadTitle || 'Importado',
            item.tags || []
          );
          count++;
        }
      });
      toast(`${count} cartões importados com sucesso!`, 'success');
      updateNavBadge();
      $('#bulk-json').value = '';
    } catch (e) {
      toast('JSON inválido: ' + e.message, 'error');
    }
  }

  // ── BROWSE ──
  function renderBrowse() {
    const main = $('#main-content');
    const cards = Storage.getCards();
    const config = Storage.getConfig();
    const threads = Object.keys(Storage.getThreads());
    const tags = Storage.getAllTags();

    // Apply filters
    let filtered = cards.filter(c => {
      if (browseFilters.search) {
        const q = browseFilters.search.toLowerCase();
        if (!c.frente.toLowerCase().includes(q) && !c.verso.toLowerCase().includes(q)) return false;
      }
      if (browseFilters.status && Storage.getCardStatus(c) !== browseFilters.status) return false;
      if (browseFilters.thread && c.threadTitle !== browseFilters.thread) return false;
      if (browseFilters.tag && !(c.tags || []).includes(browseFilters.tag)) return false;
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let va, vb;
      switch (browseSort.field) {
        case 'nextReview':
          va = a.reviewData.nextReview; vb = b.reviewData.nextReview;
          break;
        case 'dateAdded':
          va = a.dateAdded; vb = b.dateAdded;
          break;
        case 'ef':
          va = a.reviewData.easinessFactor; vb = b.reviewData.easinessFactor;
          break;
        case 'interval':
          va = a.reviewData.intervalDays; vb = b.reviewData.intervalDays;
          break;
        default:
          va = a.reviewData.nextReview; vb = b.reviewData.nextReview;
      }
      if (va < vb) return browseSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return browseSort.dir === 'asc' ? 1 : -1;
      return 0;
    });

    const statusLabels = { new: 'Novo', learning: 'Aprendendo', mature: 'Maduro', retired: 'Aposentado', leech: 'Sanguessuga' };

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Navegador de Cartões</h1>
        <p class="page-subtitle">${cards.length} cartões no total · ${filtered.length} exibidos</p>
      </div>

      <div class="browse-toolbar">
        <div class="search-input-wrapper">
          <i data-lucide="search"></i>
          <input type="text" class="search-input" placeholder="Buscar cartões..." value="${escapeHtml(browseFilters.search)}" oninput="App.updateBrowseFilter('search', this.value)" />
        </div>
        <select class="filter-select" onchange="App.updateBrowseFilter('status', this.value)">
          <option value="">Todos os Status</option>
          <option value="new" ${browseFilters.status === 'new' ? 'selected' : ''}>Novos</option>
          <option value="learning" ${browseFilters.status === 'learning' ? 'selected' : ''}>Aprendendo</option>
          <option value="mature" ${browseFilters.status === 'mature' ? 'selected' : ''}>Maduros</option>
          <option value="retired" ${browseFilters.status === 'retired' ? 'selected' : ''}>Aposentados</option>
          <option value="leech" ${browseFilters.status === 'leech' ? 'selected' : ''}>Sanguessugas</option>
        </select>
        <select class="filter-select" onchange="App.updateBrowseFilter('thread', this.value)">
          <option value="">Todos os Tópicos</option>
          ${threads.map(t => `<option value="${escapeHtml(t)}" ${browseFilters.thread === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
        <select class="filter-select" onchange="App.updateBrowseFilter('tag', this.value)">
          <option value="">Todas as Tags</option>
          ${tags.map(t => `<option value="${escapeHtml(t)}" ${browseFilters.tag === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>

      ${selectedCards.size > 0 ? `
        <div class="bulk-actions">
          <span class="bulk-count">${selectedCards.size} selecionados</span>
          <button class="btn btn-sm btn-danger" onclick="App.bulkDelete()">
            <i data-lucide="trash-2"></i> Excluir
          </button>
          <button class="btn btn-sm btn-ghost" onclick="App.clearSelection()">Cancelar</button>
        </div>
      ` : ''}

      <div class="card" style="padding: 0; overflow-x: auto;">
        <table class="cards-table">
          <thead>
            <tr>
              <th class="td-checkbox">
                <input type="checkbox" class="card-checkbox" onchange="App.toggleSelectAll(this.checked)" ${selectedCards.size === filtered.length && filtered.length > 0 ? 'checked' : ''} />
              </th>
              <th class="sortable ${browseSort.field === 'nextReview' ? 'sort-' + browseSort.dir : ''}" onclick="App.toggleSort('nextReview')">Próx. Revisão</th>
              <th>Pergunta</th>
              <th class="td-thread">Tópico</th>
              <th class="td-tags">Tags</th>
              <th>Status</th>
              <th class="sortable ${browseSort.field === 'interval' ? 'sort-' + browseSort.dir : ''}" onclick="App.toggleSort('interval')">Intervalo</th>
              <th class="sortable ${browseSort.field === 'ef' ? 'sort-' + browseSort.dir : ''}" onclick="App.toggleSort('ef')">EF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr><td colspan="9" class="text-center text-muted" style="padding: var(--space-8)">Nenhum cartão encontrado</td></tr>
            ` : filtered.map(card => {
              const status = Storage.getCardStatus(card);
              return `
                <tr data-id="${card.id}">
                  <td class="td-checkbox">
                    <input type="checkbox" class="card-checkbox" ${selectedCards.has(card.id) ? 'checked' : ''} onchange="App.toggleCardSelect('${card.id}', this.checked)" />
                  </td>
                  <td style="font-variant-numeric: tabular-nums; white-space: nowrap">${formatDate(card.reviewData.nextReview)}</td>
                  <td class="td-question" title="${escapeHtml(card.frente)}">${escapeHtml(card.frente)}</td>
                  <td class="td-thread">${escapeHtml(card.threadTitle)}</td>
                  <td class="td-tags">${(card.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</td>
                  <td><span class="badge badge-${status}">${statusLabels[status] || status}</span></td>
                  <td style="font-variant-numeric: tabular-nums">${intervalLabel(card.reviewData.intervalDays)}</td>
                  <td style="font-variant-numeric: tabular-nums">${card.reviewData.easinessFactor.toFixed(2)}</td>
                  <td>
                    <div class="flex gap-2">
                      <button class="btn btn-icon btn-ghost" onclick="App.editCard('${card.id}')" title="Editar">
                        <i data-lucide="pencil" style="width:14px;height:14px"></i>
                      </button>
                      <button class="btn btn-icon btn-ghost" onclick="App.confirmDeleteCard('${card.id}')" title="Excluir" style="color: var(--color-error)">
                        <i data-lucide="trash-2" style="width:14px;height:14px"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    lucide.createIcons();
  }

  function updateBrowseFilter(key, value) {
    browseFilters[key] = value;
    renderBrowse();
  }

  function toggleSort(field) {
    if (browseSort.field === field) {
      browseSort.dir = browseSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      browseSort.field = field;
      browseSort.dir = 'asc';
    }
    renderBrowse();
  }

  function toggleCardSelect(id, checked) {
    if (checked) selectedCards.add(id);
    else selectedCards.delete(id);
    renderBrowse();
  }

  function toggleSelectAll(checked) {
    const cards = Storage.getCards();
    // Apply same filters
    let filtered = cards.filter(c => {
      if (browseFilters.search) {
        const q = browseFilters.search.toLowerCase();
        if (!c.frente.toLowerCase().includes(q) && !c.verso.toLowerCase().includes(q)) return false;
      }
      if (browseFilters.status && Storage.getCardStatus(c) !== browseFilters.status) return false;
      if (browseFilters.thread && c.threadTitle !== browseFilters.thread) return false;
      if (browseFilters.tag && !(c.tags || []).includes(browseFilters.tag)) return false;
      return true;
    });

    selectedCards.clear();
    if (checked) filtered.forEach(c => selectedCards.add(c.id));
    renderBrowse();
  }

  function clearSelection() {
    selectedCards.clear();
    renderBrowse();
  }

  function bulkDelete() {
    showModal(
      'Excluir Cartões',
      `<p>Tem certeza que deseja excluir <strong>${selectedCards.size}</strong> cartões? Esta ação não pode ser desfeita.</p>`,
      [
        { label: 'Cancelar', class: 'btn btn-secondary' },
        { label: 'Excluir', class: 'btn btn-danger', action: () => {
          Storage.deleteCards(Array.from(selectedCards));
          selectedCards.clear();
          toast(`Cartões excluídos`, 'success');
          updateNavBadge();
          renderBrowse();
        }}
      ]
    );
  }

  function editCard(id) {
    const card = Storage.getCards().find(c => c.id === id);
    if (!card) return;

    showModal(
      'Editar Cartão',
      `
        <div class="form-group">
          <label class="form-label">Pergunta</label>
          <textarea class="form-textarea" id="edit-frente">${escapeHtml(card.frente)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Resposta</label>
          <textarea class="form-textarea" id="edit-verso">${escapeHtml(card.verso)}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Tópico</label>
            <input class="form-input" id="edit-thread" value="${escapeHtml(card.threadTitle)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tags</label>
            <input class="form-input" id="edit-tags" value="${(card.tags || []).join(', ')}" />
          </div>
        </div>
      `,
      [
        { label: 'Cancelar', class: 'btn btn-secondary' },
        { label: 'Salvar', class: 'btn btn-primary', action: () => {
          card.frente = document.getElementById('edit-frente').value.trim();
          card.verso = document.getElementById('edit-verso').value.trim();
          card.threadTitle = document.getElementById('edit-thread').value.trim() || 'Geral';
          card.tags = document.getElementById('edit-tags').value.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '_')).filter(Boolean);
          Storage.saveCard(card);
          toast('Cartão atualizado!', 'success');
          renderBrowse();
        }}
      ]
    );
  }

  function confirmDeleteCard(id) {
    showModal(
      'Excluir Cartão',
      '<p>Tem certeza que deseja excluir este cartão? Esta ação não pode ser desfeita.</p>',
      [
        { label: 'Cancelar', class: 'btn btn-secondary' },
        { label: 'Excluir', class: 'btn btn-danger', action: () => {
          Storage.deleteCard(id);
          toast('Cartão excluído', 'success');
          updateNavBadge();
          renderBrowse();
        }}
      ]
    );
  }

  // ── SETTINGS ──
  function renderSettings() {
    const main = $('#main-content');
    const config = Storage.getConfig();

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Configurações</h1>
        <p class="page-subtitle">Ajuste os parâmetros do sistema de revisão</p>
      </div>

      <div class="settings-section">
        <h3 class="settings-title">Sessão de Revisão</h3>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Máximo de cartões por sessão</div>
            <div class="setting-desc">Limite de cartões em cada sessão de revisão</div>
          </div>
          <div class="setting-control">
            <input type="range" min="5" max="50" value="${config.maxCardsPerSession}" oninput="App.updateSetting('maxCardsPerSession', parseInt(this.value)); document.getElementById('val-max').textContent = this.value" />
            <span class="setting-value" id="val-max">${config.maxCardsPerSession}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-title">Cotas por Categoria</h3>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Atrasados</div>
            <div class="setting-desc">Cartões com revisão vencida (prioridade máxima)</div>
          </div>
          <div class="setting-control">
            <input type="range" min="0" max="20" value="${config.quotas.overdue}" oninput="App.updateQuota('overdue', parseInt(this.value)); document.getElementById('val-overdue').textContent = this.value" />
            <span class="setting-value" id="val-overdue">${config.quotas.overdue}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Aprendendo</div>
            <div class="setting-desc">Cartões em fase de aprendizagem</div>
          </div>
          <div class="setting-control">
            <input type="range" min="0" max="20" value="${config.quotas.learning}" oninput="App.updateQuota('learning', parseInt(this.value)); document.getElementById('val-learning').textContent = this.value" />
            <span class="setting-value" id="val-learning">${config.quotas.learning}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Novos</div>
            <div class="setting-desc">Cartões nunca revisados</div>
          </div>
          <div class="setting-control">
            <input type="range" min="0" max="20" value="${config.quotas.new}" oninput="App.updateQuota('new', parseInt(this.value)); document.getElementById('val-new').textContent = this.value" />
            <span class="setting-value" id="val-new">${config.quotas.new}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Maduros</div>
            <div class="setting-desc">Cartões com intervalo longo</div>
          </div>
          <div class="setting-control">
            <input type="range" min="0" max="20" value="${config.quotas.mature}" oninput="App.updateQuota('mature', parseInt(this.value)); document.getElementById('val-mature').textContent = this.value" />
            <span class="setting-value" id="val-mature">${config.quotas.mature}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-title">Limites</h3>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Aposentadoria (dias)</div>
            <div class="setting-desc">Cartões com intervalo acima deste valor são considerados aposentados</div>
          </div>
          <div class="setting-control">
            <input type="range" min="30" max="365" value="${config.retirementThresholdDays}" oninput="App.updateSetting('retirementThresholdDays', parseInt(this.value)); document.getElementById('val-retire').textContent = this.value" />
            <span class="setting-value" id="val-retire">${config.retirementThresholdDays}</span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">Limite de Sanguessuga</div>
            <div class="setting-desc">Falhas consecutivas para marcar um cartão como sanguessuga</div>
          </div>
          <div class="setting-control">
            <input type="range" min="2" max="15" value="${config.leechThreshold}" oninput="App.updateSetting('leechThreshold', parseInt(this.value)); document.getElementById('val-leech').textContent = this.value" />
            <span class="setting-value" id="val-leech">${config.leechThreshold}</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-title">Dados</h3>
        <div class="settings-actions" style="border-top: none; padding-top: 0; flex-wrap: wrap">
          <button class="btn btn-secondary" onclick="App.exportData()">
            <i data-lucide="download"></i>
            Exportar JSON
          </button>
          <button class="btn btn-secondary" onclick="App.triggerImport()">
            <i data-lucide="upload"></i>
            Importar JSON
          </button>
          <button class="btn btn-danger" onclick="App.confirmReset()">
            <i data-lucide="trash-2"></i>
            Resetar Tudo
          </button>
        </div>
        <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="App.handleImportFile(this)" />
      </div>
    `;

    lucide.createIcons();
  }

  function updateSetting(key, value) {
    const config = Storage.getConfig();
    config[key] = value;
    Storage.updateConfig(config);
  }

  function updateQuota(key, value) {
    const config = Storage.getConfig();
    config.quotas[key] = value;
    Storage.updateConfig(config);
  }

  function exportData() {
    const data = Storage.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lexreview-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Dados exportados!', 'success');
  }

  function triggerImport() {
    $('#import-file-input').click();
  }

  function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = Storage.importData(e.target.result);
      if (result.success) {
        toast(`${result.count} cartões importados!`, 'success');
        updateNavBadge();
        renderSettings();
      } else {
        toast('Erro na importação: ' + result.error, 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function confirmReset() {
    showModal(
      'Resetar Todos os Dados',
      '<p style="color: var(--color-error)"><strong>Atenção!</strong> Todos os seus cartões, configurações e estatísticas serão apagados permanentemente.</p>',
      [
        { label: 'Cancelar', class: 'btn btn-secondary' },
        { label: 'Confirmar Reset', class: 'btn btn-danger', action: () => {
          // Second confirmation
          showModal(
            'Última Confirmação',
            '<p>Tem <strong>certeza absoluta</strong>? Esta ação é irreversível.</p>',
            [
              { label: 'Não, cancelar', class: 'btn btn-secondary' },
              { label: 'Sim, apagar tudo', class: 'btn btn-danger', action: () => {
                Storage.resetAll();
                toast('Dados resetados. Cartões de exemplo carregados.', 'success');
                updateNavBadge();
                Router.navigate('dashboard');
              }}
            ]
          );
        }}
      ]
    );
  }

  // ── STATISTICS ──
  function renderStats() {
    const main = $('#main-content');
    const cards = Storage.getCards();
    const config = Storage.getConfig();
    const stats = Storage.getStats();
    const catStats = SM2.getCategoryStats(cards, config);
    const retention = SM2.getRetentionRate(cards);
    const avgQuality = SM2.getAverageQuality(cards);
    const history = Storage.getReviewHistory(30);

    const historyArr = Object.entries(history).sort((a, b) => a[0].localeCompare(b[0]));
    const maxReviews = Math.max(...historyArr.map(h => h[1].count), 1);

    // Donut chart data
    const total = cards.length || 1;
    const donutData = [
      { label: 'Novos', count: catStats.new, color: 'var(--color-new)' },
      { label: 'Aprendendo', count: catStats.learning, color: 'var(--color-learning)' },
      { label: 'Maduros', count: catStats.mature, color: 'var(--color-mature)' },
      { label: 'Aposentados', count: catStats.retired, color: 'var(--color-retired)' },
      { label: 'Sanguessugas', count: catStats.leech, color: 'var(--color-leech)' },
    ].filter(d => d.count > 0);

    let donutSvg = buildDonutSVG(donutData, total);

    main.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Estatísticas</h1>
        <p class="page-subtitle">Acompanhe seu progresso de estudo</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Taxa de Retenção</span>
          <span class="stat-value">${retention}%</span>
          <span class="stat-detail">Cartões com nota ≥ 3</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Qualidade Média</span>
          <span class="stat-value">${avgQuality}</span>
          <span class="stat-detail">De 0 a 5</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Sequência</span>
          <span class="stat-value">${stats.streak} dias</span>
          <span class="stat-detail">${stats.lastReviewDate ? 'Última: ' + formatDate(stats.lastReviewDate) : 'Nenhuma revisão'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Revisões Totais</span>
          <span class="stat-value">${stats.totalReviews}</span>
        </div>
      </div>

      <div class="stats-charts-grid">
        <div class="card">
          <div class="card-header">
            <span class="card-title">Revisões — 30 Dias</span>
          </div>
          <div class="mini-bars">
            ${historyArr.map(([date, data]) => `
              <div class="mini-bar" style="height: ${data.count ? Math.max(4, (data.count / maxReviews) * 100) : 2}%" title="${formatDate(date)}: ${data.count} revisões"></div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Maturidade dos Cartões</span>
          </div>
          <div class="donut-chart">
            ${donutSvg}
          </div>
          <div class="donut-legend">
            ${donutData.map(d => `
              <div class="legend-item">
                <span class="legend-dot" style="background: ${d.color}"></span>
                <span>${d.label}: ${d.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  function buildDonutSVG(data, total) {
    if (data.length === 0) {
      return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="60" fill="none" stroke="var(--color-border)" stroke-width="20"/>
        <text x="80" y="85" text-anchor="middle" font-size="14" fill="var(--color-text-muted)">Sem dados</text>
      </svg>`;
    }

    const cx = 80, cy = 80, r = 60;
    const circumference = 2 * Math.PI * r;
    let offset = 0;
    const paths = [];

    // Resolve CSS variables to actual computed colors
    const tempEl = document.createElement('div');
    document.body.appendChild(tempEl);
    const colorMap = {};
    data.forEach(d => {
      if (d.color.startsWith('var(')) {
        tempEl.style.color = d.color;
        const computed = getComputedStyle(tempEl).color;
        // Convert rgb to hex
        const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
          colorMap[d.color] = '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
        } else {
          colorMap[d.color] = computed;
        }
      }
    });
    document.body.removeChild(tempEl);

    data.forEach(d => {
      const pct = d.count / total;
      const dashLength = pct * circumference;
      const gapLength = circumference - dashLength;
      const resolvedColor = colorMap[d.color] || d.color;
      paths.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${resolvedColor}" stroke-width="20" stroke-dasharray="${dashLength} ${gapLength}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`);
      offset += dashLength;
    });

    return `<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
      ${paths.join('')}
      <circle cx="${cx}" cy="${cy}" r="50" fill="var(--color-bg)"/>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="20" font-weight="700" fill="currentColor">${total}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">cartões</text>
    </svg>`;
  }

  // ── INITIALIZATION ──
  function init() {
    Storage.init();

    // Theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const _ls = (() => { try { return window[['local','Storage'].join('')]; } catch { return null; } })();
    let savedTheme = null;
    try { if (_ls) savedTheme = _ls.getItem('lexReviewTheme'); } catch(e) {}
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    // Mobile menu
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    if (mobileBtn) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
      });
    }

    // Register routes
    Router.register('dashboard', renderDashboard);
    Router.register('review', renderReview);
    Router.register('add', renderAdd);
    Router.register('browse', renderBrowse);
    Router.register('settings', renderSettings);
    Router.register('stats', renderStats);

    updateNavBadge();
    Router.init();
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    const _ls = (() => { try { return window[['local','Storage'].join('')]; } catch { return null; } })();
    try { if (_ls) _ls.setItem('lexReviewTheme', next); } catch(e) {}
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
      ? '<i data-lucide="sun"></i> Modo Claro'
      : '<i data-lucide="moon"></i> Modo Escuro';
    lucide.createIcons();
  }

  return {
    init,
    startReview,
    flipCard,
    rateCard,
    switchAddTab,
    handleAddCard,
    handleBulkAdd,
    updateBrowseFilter,
    toggleSort,
    toggleCardSelect,
    toggleSelectAll,
    clearSelection,
    bulkDelete,
    editCard,
    confirmDeleteCard,
    updateSetting,
    updateQuota,
    exportData,
    triggerImport,
    handleImportFile,
    confirmReset,
    toggleTheme,
    renderDashboard,
    renderReview,
    renderAdd,
    renderBrowse,
    renderSettings,
    renderStats
  };
})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
