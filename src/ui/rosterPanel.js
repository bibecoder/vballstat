export function mountRosterPanel(root, { roster, rallyPanel }) {
  function renderTeam(teamKey) {
    const players = roster.players(teamKey);
    const rows = players
      .map(
        (p) => `
      <li class="roster-row" data-team="${teamKey}" data-number="${p.number}">
        <span class="roster-number">${p.number}</span>
        <span class="roster-name" contenteditable="true" data-field="name">${escapeHtml(p.name)}</span>
        <button class="roster-remove" title="Remove player">✕</button>
      </li>`
      )
      .join('');

    return `
      <div class="roster-team" data-team="${teamKey}">
        <div class="roster-team-header">
          <input class="team-name-input" data-team="${teamKey}" value="${escapeHtml(roster.teamName(teamKey))}" />
          <span class="team-key-hint">key: ${teamKey === 'home' ? 'H' : 'A'}</span>
        </div>
        <ul class="roster-list">${rows}</ul>
        <form class="add-player-form" data-team="${teamKey}">
          <input type="number" min="0" max="99" placeholder="#" class="add-number" required />
          <input type="text" placeholder="Name" class="add-name" />
          <button type="submit">+ Add</button>
        </form>
      </div>`;
  }

  function render() {
    root.innerHTML = `
      <div class="panel-header">Roster</div>
      <div class="roster-teams">
        ${renderTeam('home')}
        ${renderTeam('away')}
      </div>
      <button class="reset-roster">Reset to sample roster</button>
    `;
    wire();
  }

  function wire() {
    root.querySelectorAll('.roster-row').forEach((row) => {
      const team = row.dataset.team;
      const number = Number(row.dataset.number);

      row.querySelector('.roster-number').addEventListener('click', () => {
        rallyPanel.insertAtCursor(`${team === 'home' ? 'H' : 'A'}${number}`);
      });

      const nameEl = row.querySelector('[data-field="name"]');
      nameEl.addEventListener('blur', () => {
        roster.renamePlayer(team, number, nameEl.textContent.trim() || `#${number}`);
      });
      nameEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          nameEl.blur();
        }
      });

      row.querySelector('.roster-remove').addEventListener('click', () => {
        roster.removePlayer(team, number);
      });
    });

    root.querySelectorAll('.team-name-input').forEach((input) => {
      input.addEventListener('change', () => {
        roster.setTeamName(input.dataset.team, input.value.trim());
      });
    });

    root.querySelectorAll('.add-player-form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const team = form.dataset.team;
        const numberInput = form.querySelector('.add-number');
        const nameInput = form.querySelector('.add-name');
        const number = Number(numberInput.value);
        if (!Number.isInteger(number) || number < 0) return;
        const ok = roster.addPlayer(team, number, nameInput.value.trim());
        if (ok) {
          numberInput.value = '';
          nameInput.value = '';
        } else {
          alert(`#${number} is already on that roster.`);
        }
      });
    });

    root.querySelector('.reset-roster').addEventListener('click', () => {
      if (confirm('Reset both rosters to the sample data? This does not touch the action log.')) {
        roster.resetToDefault();
      }
    });
  }

  roster.onChange(render);
  render();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
