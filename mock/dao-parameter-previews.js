// Fixed authoring and review examples inside the generated production modal shells.
window.DaoParameterPreview = class DaoParameterPreview {
  static currentCommittee = [
    '8f2a19c13ae97c71d8202d59e31f7c82d7a10000',
    '71ce19c13ae97c71d8202d59e31f7c82d7a183b2',
    '94bd12032b1c40ef766a12d98c341182d72f1d00',
    '1c947ea0ce978b5a16f1a06cbca79b9db943bc20',
  ];

  static proposedCommittee = [...this.currentCommittee, '0369a1d06d94f65b7c2bb075d08105d44b5c2251'];

  static removeIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`;

  static populate(modal, example) {
    if (example === 'committee-review') {
      this.renderCommitteeReview(modal);
      return;
    }

    const economic = example === 'economic';
    const options = window.DAO_PARAMETER_OPTIONS[economic ? 'economic' : 'governance'];
    const setValue = (id, value) => modal.querySelector(`#${id}`).setAttribute('value', value);
    const typeSelect = modal.querySelector('#addProposalType');
    typeSelect.querySelector(`option[value="${economic ? 'economic' : 'governance'}"]`).selected = true;
    typeSelect.selectedOptions[0].setAttribute('selected', '');
    setValue('addProposalFee', '50 USD');
    setValue('addProposalTitle', economic ? 'Update network fees and versions' : 'Add a committee member');
    modal.querySelector('#addProposalDescription').textContent = economic
      ? 'Update the transaction fee, early departure penalty, and archiver versions.'
      : 'Add a fifth member to the DAO committee.';
    modal.querySelector('#addProposalGracePeriodMs').textContent = '86,400,000';
    modal.querySelector('#addProposalGracePeriodHelp').textContent = 'Duration: 1 day';
    modal.querySelector('#addProposalOptionsList').innerHTML = `
      <div class="dao-form-option dao-form-option--no-change"><div class="dao-form-row-title"><label>Option: No change</label></div><div class="form-control dao-form-current-value">No change</div><p class="dao-form-help">This required first option makes no parameter changes.</p></div>
      <section class="dao-form-option" data-dao-option="0">
        <div class="dao-form-row-title"><label>Option 1</label>${this.removeButton('Remove option 1', 'disabled')}</div>
        <div class="dao-form-section-header"><label>Parameter Changes</label></div>
        <div class="dao-form-list">${economic ? this.renderEconomicChanges(options) : this.renderCommitteeChange(options, example === 'committee-duplicate')}</div>
        ${this.addButton('Add parameter change')}
      </section>`;
  }

  static renderCommitteeChange(options, duplicate) {
    const proposed = duplicate ? [...this.currentCommittee, `0x${this.currentCommittee[0].toUpperCase()}`] : this.proposedCommittee;
    return this.renderChange(options, 'committeeAddresses', 1,
      `<div id="mockParameterCurrent1" class="form-control dao-form-current-value" role="group" aria-label="Current committee addresses">${this.renderCommitteeAddresses(this.currentCommittee)}</div>`,
      `<div id="mockParameterProposed1" class="dao-committee-address-editor" role="group" aria-label="Proposed committee addresses" aria-describedby="mockCommitteeHelp mockCommitteeError" tabindex="-1"${duplicate ? ' aria-invalid="true"' : ''}>
        ${proposed.map((address, index) => this.renderCommitteeRow(address, index)).join('')}${this.addButton('Add address')}
        <p id="mockCommitteeHelp" class="dao-form-help">4–10 unique addresses. The 0x prefix is optional.</p>
        <p id="mockCommitteeError" class="dao-committee-address-error${duplicate ? '' : ' hidden'}" aria-live="polite">${duplicate ? 'Committee address 5 is a duplicate' : ''}</p>
      </div>`,
      { committee: true, invalid: duplicate });
  }

  static renderCommitteeRow(address, index) {
    return `<div class="dao-committee-address-row">
      <input class="form-control" type="text" value="${address}" aria-label="Committee address ${index + 1}" aria-describedby="mockCommitteeHelp mockCommitteeError" autocomplete="off" autocapitalize="none" spellcheck="false" required />
      ${this.removeButton(`Remove committee address ${index + 1}`)}
    </div>`;
  }

  static renderEconomicChanges(options) {
    return [
      this.renderChange(options, 'transactionFeeUsdStr', 1,
        '<input id="mockParameterCurrent1" class="form-control dao-form-current-value" type="text" value="0.02" readonly />',
        '<input id="mockParameterProposed1" class="form-control" type="text" inputmode="decimal" maxlength="34" value="0.01" required />'),
      this.renderChange(options, 'leftNetworkEarlyPenaltyPercent', 2,
        '<input id="mockParameterCurrent2" class="form-control dao-form-current-value" type="text" value="0.2" readonly />',
        '<input id="mockParameterProposed2" class="form-control" type="number" inputmode="decimal" min="0" step="any" value="0.25" required />'),
      this.renderChange(options, 'archiver', 3, this.renderArchiverVersions(true), this.renderArchiverVersions(false)),
    ].join('');
  }

  static renderArchiverVersions(readOnly) {
    const side = readOnly ? 'Current' : 'Proposed';
    return `<div id="mockParameter${side}3" class="dao-form-list" role="group" aria-label="${side} archiver versions">${[
      ['Minimum version', '1.4.0', '1.4.1'],
      ['Active version', '1.4.1', '1.4.2'],
      ['Latest version', '1.4.2', '1.4.3'],
    ].map(([label, current, proposed], index) => `
      <div class="form-group"><label for="mockArchiver${side}${index}">${label}</label>
        <input id="mockArchiver${side}${index}" class="form-control${readOnly ? ' dao-form-current-value' : ''}" type="text" value="${readOnly ? current : proposed}" ${readOnly ? 'readonly' : 'required'} />
      </div>`).join('')}</div>`;
  }

  static renderChange(options, key, index, current, proposed, { committee = false, invalid = false } = {}) {
    const { label, path, valueType, unit, unitHint } = options.find((option) => option.key === key);
    const type = unit ? `${valueType} in ${unit}${unitHint ? ` (${unitHint})` : ''}` : valueType;
    const lineClass = `dao-form-change-line${committee ? ' dao-form-change-line--committee' : ''}`;
    const remove = this.removeButton(`Remove parameter change ${index} from Option 1`, committee ? 'disabled' : '');
    return `<div class="dao-form-row dao-form-row--change">
      <div class="dao-form-row-title"><label>Parameter change ${index}</label>${remove}</div>
      <div class="dao-form-change-box${invalid ? ' dao-form-error' : ''}">
        <div class="dao-form-change-line"><label for="mockParameter${index}">Select <span class="dao-form-required" aria-hidden="true">*</span></label><select id="mockParameter${index}" class="form-control" aria-label="Select parameter for Option 1, change ${index}" required><option>${label}</option></select></div>
        <div class="${lineClass}"><label for="mockParameterCurrent${index}">Current</label>${current}</div>
        <div class="${lineClass}"><label for="mockParameterProposed${index}">Enter <span class="dao-form-required" aria-hidden="true">*</span></label>${proposed}</div>
        <div class="dao-form-meta">${path} · ${type}</div>
      </div>
    </div>`;
  }

  static removeButton(label, state = '') {
    return `<button type="button" class="btn btn--secondary dao-form-remove-button" aria-label="${label}" title="${label}" ${state}>${this.removeIcon}</button>`;
  }

  static addButton(label) {
    return `<button type="button" class="btn btn--secondary dao-form-add-button"><span class="dao-form-add-icon" aria-hidden="true"><span class="plus-glyph">+</span></span><span>${label}</span></button>`;
  }

  static renderCommitteeAddresses(addresses) {
    return `<span class="dao-committee-address-list" role="list">${addresses.map((address) => `<span role="listitem"><button type="button" class="dao-committee-address" data-mock-copy-address="${address}" title="Copy address" aria-label="Copy address ${address}">${address}</button></span>`).join('')}</span>`;
  }

  static bind(document) {
    document.querySelectorAll('[data-mock-copy-address]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await document.defaultView.navigator.clipboard.writeText(button.dataset.mockCopyAddress);
          button.title = 'Address copied to clipboard';
        } catch {
          button.title = 'Failed to copy address';
        }
      });
    });

    const editor = document.querySelector('.dao-committee-address-editor');
    if (!editor) return;
    const add = editor.querySelector('.dao-form-add-button');
    add.addEventListener('click', () => {
      const index = editor.querySelectorAll('.dao-committee-address-row').length;
      add.insertAdjacentHTML('beforebegin', this.renderCommitteeRow('', index));
      this.validateCommittee(editor, add);
      add.previousElementSibling.querySelector('input').focus();
    });
    editor.addEventListener('click', (event) => {
      const remove = event.target.closest('.dao-form-remove-button');
      if (!remove) return;
      const row = remove.closest('.dao-committee-address-row');
      const nextInput = row.nextElementSibling.querySelector('input');
      row.remove();
      this.validateCommittee(editor, add);
      (nextInput || add).focus();
    });
    editor.addEventListener('input', () => this.validateCommittee(editor, add));
    this.validateCommittee(editor, add);
  }

  static validateCommittee(editor, add) {
    const inputs = [...editor.querySelectorAll('.dao-committee-address-row input')];
    const addresses = new Set();
    let message = '';
    inputs.forEach((input, index) => {
      const label = `Committee address ${index + 1}`;
      const remove = input.nextElementSibling;
      input.setAttribute('aria-label', label);
      remove.setAttribute('aria-label', `Remove ${label.toLowerCase()}`);
      remove.title = remove.getAttribute('aria-label');
      const address = input.value.trim().toLowerCase().replace(/^0x/, '');
      const normalized = address.padEnd(64, '0');
      let error = '';
      if (!address) error = `Enter ${label.toLowerCase()}`;
      else if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(address)) error = `${label} must contain 40 or 64 hexadecimal characters, with an optional 0x prefix`;
      else if (addresses.has(normalized)) error = `${label} is a duplicate`;
      addresses.add(normalized);
      input.setAttribute('aria-invalid', String(Boolean(error)));
      message ||= error;
    });
    add.disabled = inputs.length >= 10;
    if (inputs.length < 4) message = `Enter 4–10 committee addresses (currently ${inputs.length})`;
    const error = editor.querySelector('.dao-committee-address-error');
    error.textContent = message;
    error.classList.toggle('hidden', !message);
    editor.setAttribute('aria-invalid', String(Boolean(message)));
    editor.closest('.dao-form-change-box').classList.toggle('dao-form-error', Boolean(message));
  }

  static renderCommitteeReview(modal) {
    modal.querySelector('#confirmProposalContent').innerHTML = `
      <div class="proposal-info-heading"><h2 class="proposal-info-title">Add a committee member</h2><p class="proposal-type-indicator">Standard Governance proposal</p><p class="proposal-info-description">Add a fifth member to the DAO committee.</p></div>
      <section class="proposal-info-section"><h3>Proposal Options</h3><div class="proposal-option-cards">
        <div class="proposal-option-section proposal-option-section--no-change"><span class="proposal-option-label">no</span><p class="proposal-info-muted"><span class="proposal-change-arrow" aria-hidden="true">&rarr;</span> No parameter changes.</p></div>
        <div class="proposal-option-section"><span class="proposal-option-label">Option 1</span><div class="proposal-option-changes">
          <div class="proposal-change-row proposal-change-row--committee"><span>committeeAddresses</span><div class="proposal-change-values">
            <small><span>Current:</span><strong>${this.renderCommitteeAddresses(this.currentCommittee)}</strong></small>
            <span class="proposal-change-arrow" aria-hidden="true">&rarr;</span>
            <small><span>New:</span><strong>${this.renderCommitteeAddresses(this.proposedCommittee)}</strong></small>
          </div></div>
        </div></div>
      </div></section>
      ${this.reviewSection('Overview', [['Type', 'Governance'], ['Proposal fee', '50 USD'], ['Initial state', 'Review after submission']])}
      ${this.reviewSection('Review Timeline', [['Scheduled review start', 'Start now'], ['Time until start', '0 sec (0 ms)'], ['Grace period', '1 day']])}
      <p class="proposal-info-muted">Signing submits this proposal for review and seeds the voter reward pool.</p>`;
  }

  static reviewSection(title, values) {
    return `<section class="proposal-info-section"><h3>${title}</h3><div class="proposal-info-grid">${values.map(([label, value]) => `<div class="proposal-info-row"><span>${label}</span><span class="proposal-info-value">${value}</span></div>`).join('')}</div></section>`;
  }
};
