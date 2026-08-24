let selectedGuildId = null;
let allMemories = [];

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    document.getElementById('uptimeVal').textContent = data.uptime || '--';
    document.getElementById('moodVal').textContent = data.currentMood || '--';
    document.getElementById('ramVal').textContent = `${data.memoryMb || 0} MB`;
    document.getElementById('guildsCount').textContent = data.guildsCount || 0;

    const orb = document.getElementById('botStatusOrb');
    if (data.online) {
      orb.style.background = '#10b981';
      orb.style.boxShadow = '0 0 12px #10b981';
    } else {
      orb.style.background = '#ef4444';
      orb.style.boxShadow = '0 0 12px #ef4444';
    }
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

async function fetchGuilds() {
  try {
    const res = await fetch('/api/guilds');
    const data = await res.json();
    const list = document.getElementById('guildList');
    list.innerHTML = '';

    if (!data.guilds || !data.guilds.length) {
      list.innerHTML = '<div class="empty-state">No Discord servers connected yet.</div>';
      return;
    }

    data.guilds.forEach((g, idx) => {
      if (idx === 0 && !selectedGuildId) selectedGuildId = g.id;

      const item = document.createElement('div');
      item.className = `guild-item ${selectedGuildId === g.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="guild-icon"></div>
        <div class="guild-info">
          <h4>${g.name}</h4>
          <p>${g.memberCount} members</p>
        </div>
      `;
      item.addEventListener('click', () => {
        selectedGuildId = g.id;
        document.querySelectorAll('.guild-item').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
        loadGuildData();
      });
      list.appendChild(item);
    });

    loadGuildData();
  } catch (err) {
    console.error('Failed to fetch guilds:', err);
  }
}

async function fetchMemories() {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/memories?guildId=${selectedGuildId}`);
    const data = await res.json();
    allMemories = data.memories || [];
    renderMemories(allMemories);
  } catch (err) {
    console.error('Failed to fetch memories:', err);
  }
}

function renderMemories(memories) {
  const tbody = document.getElementById('memoriesTbody');
  tbody.innerHTML = '';

  if (!memories.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No memories recorded yet for this server.</td></tr>';
    return;
  }

  memories.forEach((m) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>#${m.id}</code></td>
      <td><span class="tag-pill">${m.type}</span></td>
      <td>${m.content}</td>
      <td><code class="tag-pill">&lt;@${m.user_id}&gt;</code></td>
      <td>
        <button class="btn btn-secondary" onclick="deleteMemory(${m.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteMemory(id) {
  if (!confirm(`Delete memory #${id}?`)) return;
  try {
    await fetch(`/api/memories/${id}?guildId=${selectedGuildId}`, { method: 'DELETE' });
    fetchMemories();
  } catch (err) {
    alert('Failed to delete memory: ' + err.message);
  }
}

async function fetchLore() {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/lore?guildId=${selectedGuildId}`);
    const data = await res.json();
    const grid = document.getElementById('loreGrid');
    grid.innerHTML = '';

    if (!data.lore || !data.lore.length) {
      grid.innerHTML = '<div class="empty-state">No server lore recorded yet. Click "+ Record Lore" above or type <code>!lore add</code> in Discord!</div>';
      return;
    }

    data.lore.forEach((l) => {
      const card = document.createElement('div');
      card.className = 'lore-card';
      card.innerHTML = `
        <div class="lore-card-header">
          <span class="tag-pill">${l.category}</span>
          <span class="badge">#${l.id}</span>
        </div>
        <h4>${l.title}</h4>
        <p>${l.content}</p>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to fetch lore:', err);
  }
}

async function fetchStats() {
  if (!selectedGuildId) return;
  try {
    const res = await fetch(`/api/stats?guildId=${selectedGuildId}`);
    const data = await res.json();
    document.getElementById('totalMessagesStat').textContent = data.stats?.totalMessages || 0;
    document.getElementById('activeUsersStat').textContent = data.stats?.activeUsers || 0;
    document.getElementById('replyChanceStat').textContent = `${Math.round((data.settings?.replyChance || 0.15) * 100)}%`;
  } catch (err) {
    console.error('Failed to fetch stats:', err);
  }
}

function loadSampleHotTakes() {
  const container = document.getElementById('hotTakesList');
  const samples = [
    'Pineapple belongs on pizza.',
    'Tabs > Spaces for universal accessibility.',
    'Minecraft is still the ultimate comfort game.',
    'Dark mode is overrated; high ambient light demands light theme.',
    'Valorant skins are 100% placebo effect.',
    'Cold leftover pizza is better than fresh hot pizza.',
    'TypeScript should be mandatory for all production JavaScript.'
  ];
  container.innerHTML = samples.map((s) => `<div class="hottake-item">🔥 "${s}"</div>`).join('');
}

function loadGuildData() {
  fetchMemories();
  fetchLore();
  fetchStats();
}

// Event Listeners
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('memorySearch').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allMemories.filter((m) =>
    m.content.toLowerCase().includes(query) || m.type.toLowerCase().includes(query)
  );
  renderMemories(filtered);
});

document.getElementById('refreshMemoriesBtn').addEventListener('click', fetchMemories);

// Lore Modal
const loreModal = document.getElementById('loreModal');
document.getElementById('openAddLoreModalBtn').addEventListener('click', () => {
  loreModal.classList.add('open');
});
document.getElementById('closeLoreModalBtn').addEventListener('click', () => {
  loreModal.classList.remove('open');
});
document.getElementById('cancelLoreBtn').addEventListener('click', () => {
  loreModal.classList.remove('open');
});

document.getElementById('addLoreForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('loreTitleInput').value;
  const category = document.getElementById('loreCategorySelect').value;
  const content = document.getElementById('loreContentInput').value;

  try {
    await fetch('/api/lore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId: selectedGuildId, title, category, content })
    });
    loreModal.classList.remove('open');
    document.getElementById('addLoreForm').reset();
    fetchLore();
  } catch (err) {
    alert('Failed to save lore: ' + err.message);
  }
});

// Initialization & Polling
fetchStatus();
fetchGuilds();
loadSampleHotTakes();
setInterval(fetchStatus, 5000);
