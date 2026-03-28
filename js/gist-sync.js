/**
 * LexReview - GitHub Gist Sync
 * Sincroniza dados entre navegadores/dispositivos via GitHub Gist (privado).
 * 
 * Fluxo:
 * 1. Usuário configura um Personal Access Token (PAT) do GitHub com permissão "gist"
 * 2. Na primeira sync, cria um Gist privado com os dados
 * 3. Nas syncs seguintes, faz merge inteligente: cards novos são adicionados,
 *    cards existentes mantêm a versão com mais revisões (mais avançada)
 */

const GistSync = (() => {
  const GIST_API = 'https://api.github.com/gists';
  const SYNC_KEY = 'lexReview_sync';
  const FILENAME = 'lexreview-data.json';

  // Storage wrapper with in-memory fallback for sandboxed iframes
  const _store = (() => {
    const mem = {};
    const ls = (() => { try { return window[['local','Storage'].join('')]; } catch { return null; } })();
    if (ls) {
      try {
        const t = '__sync_t__';
        ls.setItem(t, '1');
        ls.removeItem(t);
        return { getItem: k => ls.getItem(k), setItem: (k, v) => ls.setItem(k, v), removeItem: k => { ls.removeItem(k); } };
      } catch { /* fall through */ }
    }
    return {
      getItem: k => mem[k] ?? null,
      setItem: (k, v) => { mem[k] = v; },
      removeItem: k => { delete mem[k]; }
    };
  })();

  // ── Storage para config de sync (separada dos cards) ──
  function _getSyncConfig() {
    try {
      const raw = _store.getItem(SYNC_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function _saveSyncConfig(config) {
    try {
      _store.setItem(SYNC_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save sync config:', e);
    }
  }

  function getToken() {
    return _getSyncConfig().token || '';
  }

  function getGistId() {
    return _getSyncConfig().gistId || '';
  }

  function getLastSync() {
    return _getSyncConfig().lastSync || null;
  }

  function isConfigured() {
    return !!(getToken() && getGistId());
  }

  function hasToken() {
    return !!getToken();
  }

  // ── Configuração ──
  function setToken(token) {
    const config = _getSyncConfig();
    config.token = token.trim();
    _saveSyncConfig(config);
  }

  function setGistId(id) {
    const config = _getSyncConfig();
    config.gistId = id.trim();
    _saveSyncConfig(config);
  }

  function _setLastSync() {
    const config = _getSyncConfig();
    config.lastSync = new Date().toISOString();
    _saveSyncConfig(config);
  }

  function clearConfig() {
    _store.removeItem(SYNC_KEY);
  }

  // ── API calls ──
  async function _apiCall(method, url, body = null) {
    const token = getToken();
    if (!token) throw new Error('Token não configurado');

    const opts = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 401) throw new Error('Token inválido ou expirado');
      if (res.status === 404) throw new Error('Gist não encontrado');
      throw new Error(`GitHub API error ${res.status}: ${errBody}`);
    }
    return res.json();
  }

  // ── Validar token ──
  async function validateToken(token) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!res.ok) return { valid: false, error: 'Token inválido' };
      const user = await res.json();
      return { valid: true, username: user.login };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  // ── Criar Gist ──
  async function createGist() {
    const localData = Storage.getAll();
    const payload = {
      description: 'LexReview - Dados de Revisão Espaçada (não editar manualmente)',
      public: false,
      files: {
        [FILENAME]: {
          content: JSON.stringify(localData, null, 2)
        }
      }
    };

    const gist = await _apiCall('POST', GIST_API, payload);
    setGistId(gist.id);
    _setLastSync();
    return gist.id;
  }

  // ── Ler dados do Gist ──
  async function fetchGistData() {
    const gistId = getGistId();
    if (!gistId) throw new Error('Gist ID não configurado');

    const gist = await _apiCall('GET', `${GIST_API}/${gistId}`);
    const file = gist.files[FILENAME];
    if (!file) throw new Error('Arquivo de dados não encontrado no Gist');
    
    return JSON.parse(file.content);
  }

  // ── Salvar dados no Gist ──
  async function pushToGist(data) {
    const gistId = getGistId();
    if (!gistId) throw new Error('Gist ID não configurado');

    await _apiCall('PATCH', `${GIST_API}/${gistId}`, {
      files: {
        [FILENAME]: {
          content: JSON.stringify(data, null, 2)
        }
      }
    });
    _setLastSync();
  }

  // ── Merge inteligente ──
  function mergeData(local, remote) {
    // Mapa de cards por ID
    const localMap = new Map(local.cards.map(c => [c.id, c]));
    const remoteMap = new Map(remote.cards.map(c => [c.id, c]));
    
    const merged = [];
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
    let conflicts = 0;

    for (const id of allIds) {
      const lc = localMap.get(id);
      const rc = remoteMap.get(id);

      if (lc && !rc) {
        // Só existe local
        merged.push(lc);
      } else if (!lc && rc) {
        // Só existe remoto
        merged.push(rc);
      } else {
        // Existe em ambos — mantém o que tem mais progresso de revisão
        const lHistory = lc.reviewData.reviewHistory?.length || 0;
        const rHistory = rc.reviewData.reviewHistory?.length || 0;
        
        if (lHistory >= rHistory) {
          // Local tem igual ou mais revisões
          merged.push(lc);
        } else {
          // Remoto tem mais revisões
          merged.push(rc);
          conflicts++;
        }
      }
    }

    // Merge config: usa o local (preferência do dispositivo atual)
    const config = local.config || remote.config;

    // Merge stats: pega os maiores valores
    const stats = {
      totalReviews: Math.max(local.stats?.totalReviews || 0, remote.stats?.totalReviews || 0),
      streak: Math.max(local.stats?.streak || 0, remote.stats?.streak || 0),
      lastReviewDate: [local.stats?.lastReviewDate, remote.stats?.lastReviewDate]
        .filter(Boolean)
        .sort()
        .pop() || null
    };

    return {
      data: { cards: merged, config, stats },
      summary: {
        localOnly: [...localMap.keys()].filter(id => !remoteMap.has(id)).length,
        remoteOnly: [...remoteMap.keys()].filter(id => !localMap.has(id)).length,
        merged: allIds.size,
        conflicts
      }
    };
  }

  // ── Sync completo (pull → merge → push → save local) ──
  async function sync() {
    if (!isConfigured()) {
      throw new Error('Sincronização não configurada. Adicione seu token do GitHub nas Configurações.');
    }

    const localData = Storage.getAll();
    
    let remoteData;
    try {
      remoteData = await fetchGistData();
    } catch (e) {
      // Se Gist foi deletado ou corrompido, recria
      if (e.message.includes('não encontrado') || e.message.includes('404')) {
        await createGist();
        return { 
          action: 'created',
          summary: { localOnly: localData.cards.length, remoteOnly: 0, merged: localData.cards.length, conflicts: 0 }
        };
      }
      throw e;
    }

    const { data: mergedData, summary } = mergeData(localData, remoteData);

    // Salva localmente
    Storage.importData(JSON.stringify(mergedData));

    // Push para o Gist
    await pushToGist(mergedData);

    return { action: 'synced', summary };
  }

  // ── Setup inicial (validar token + criar ou vincular Gist) ──
  async function setup(token, existingGistId = '') {
    // Valida token
    const validation = await validateToken(token);
    if (!validation.valid) throw new Error(validation.error);

    setToken(token);

    if (existingGistId) {
      // Tenta usar o Gist existente
      setGistId(existingGistId);
      try {
        await fetchGistData(); // Testa se existe e tem o arquivo
        // Faz a primeira sync
        const result = await sync();
        return { username: validation.username, gistId: existingGistId, ...result };
      } catch {
        // Se falhou, cria um novo
        const newGistId = await createGist();
        return { 
          username: validation.username, 
          gistId: newGistId, 
          action: 'created',
          summary: { localOnly: Storage.getCards().length, remoteOnly: 0, merged: Storage.getCards().length, conflicts: 0 }
        };
      }
    } else {
      // Cria novo Gist
      const gistId = await createGist();
      return { 
        username: validation.username, 
        gistId, 
        action: 'created',
        summary: { localOnly: Storage.getCards().length, remoteOnly: 0, merged: Storage.getCards().length, conflicts: 0 }
      };
    }
  }

  return {
    isConfigured,
    hasToken,
    getToken,
    getGistId,
    getLastSync,
    setToken,
    setGistId,
    clearConfig,
    validateToken,
    createGist,
    fetchGistData,
    pushToGist,
    sync,
    setup
  };
})();
