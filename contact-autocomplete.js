export class ContactSearch {
  /**
   * Lists the profile fields a contact can be found by, each once per distinct value.
   * Only these fields are searched: the rest of senderInfo (avatarId, avatarKey, timezone)
   * holds identifiers and keys a user never searches for and should not see in a result label.
   * @param {object} contact
   * @returns {Array<{field: string, value: string}>} display label and raw value per field
   */
  static getSearchableFields(contact) {
    const fields = [];
    const seenValues = new Set();

    for (const field of ['username', 'name', 'email', 'phone', 'linkedin', 'x']) {
      for (const rawValue of [contact[field], contact.senderInfo?.[field]]) {
        const value = String(rawValue ?? '').trim();
        const lowerValue = value.toLowerCase();
        if (!value || seenValues.has(lowerValue)) continue;
        seenValues.add(lowerValue);
        fields.push({ field, value });
      }
    }

    return fields;
  }

  static getMatchType(contact, searchLower) {
    const fields = ContactSearch.getSearchableFields(contact).map(({ value }) => value.toLowerCase());
    if (fields.includes(searchLower)) return 2;
    if (fields.some((value) => value.startsWith(searchLower))) return 1;
    return fields.some((value) => value.includes(searchLower)) ? 0 : -1;
  }
}

export class ContactAutocomplete {
  constructor({ input, list, getContacts, onSelect }) {
    this.input = input;
    this.list = list;
    this.getContacts = getContacts;
    this.onSelect = onSelect;
    this.contacts = [];
    this.activeIndex = -1;

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    list.setAttribute('role', 'listbox');
    this.close();

    input.addEventListener('focus', () => this.render());
    input.addEventListener('click', () => {
      if (list.hidden) this.render();
    });
    input.addEventListener('input', (event) => {
      if (event.isTrusted && input === input.ownerDocument.activeElement) this.render();
      else this.close();
    });
    input.addEventListener('blur', () => this.close());
    input.addEventListener('keydown', (event) => this.handleKeyDown(event));

    // Keep focus on the input during a pick. A touch scroll does not fire mousedown.
    list.addEventListener('mousedown', (event) => {
      if (event.target.closest('.contact-autocomplete-option')) event.preventDefault();
    });
    list.addEventListener('click', (event) => {
      const option = event.target.closest('.contact-autocomplete-option');
      if (option) this.select(Number(option.dataset.index));
    });
  }

  static getDisplayName(contact) {
    return contact.displayName || contact.name || contact.username;
  }

  getMatches() {
    const query = this.input.value.trim().toLowerCase();
    const contacts = this.getContacts();
    const compareUsernames = (a, b) => (a.username || '').localeCompare(b.username || '');

    if (!query) {
      return [...contacts].sort((a, b) =>
        ContactAutocomplete.getDisplayName(a).localeCompare(ContactAutocomplete.getDisplayName(b))
        || compareUsernames(a, b));
    }

    return contacts
      .map((contact) => ({ contact, rank: ContactSearch.getMatchType(contact, query) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => b.rank - a.rank || compareUsernames(a.contact, b.contact))
      .map(({ contact }) => contact);
  }

  render() {
    this.contacts = this.getMatches();
    this.activeIndex = -1;
    this.input.removeAttribute('aria-activedescendant');
    const options = this.list.ownerDocument.createDocumentFragment();
    this.contacts.forEach((contact, index) => options.append(this.createOption(contact, index)));
    this.list.replaceChildren(options);
    this.list.scrollTop = 0;
    this.list.hidden = this.contacts.length === 0;
    this.input.setAttribute('aria-expanded', String(!this.list.hidden));
  }

  createOption(contact, index) {
    const document = this.list.ownerDocument;
    const option = document.createElement('div');
    option.id = `${this.list.id}-option-${index}`;
    option.className = 'contact-autocomplete-option';
    option.dataset.index = index;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', 'false');
    const name = ContactAutocomplete.getDisplayName(contact);
    const label = document.createElement('span');
    label.textContent = name;
    option.append(label);

    if (contact.username && contact.username !== name) {
      const username = document.createElement('span');
      username.className = 'contact-autocomplete-username';
      username.textContent = `@${contact.username}`;
      option.append(username);
    }
    return option;
  }

  handleKeyDown(event) {
    if (event.isComposing) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (this.list.hidden) this.render();
      if (this.list.hidden) return;
      event.preventDefault();
      const lastIndex = this.contacts.length - 1;
      const next = event.key === 'ArrowDown'
        ? Math.min(this.activeIndex + 1, lastIndex)
        : this.activeIndex < 0 ? lastIndex : Math.max(this.activeIndex - 1, 0);
      this.setActiveOption(next);
    } else if (!this.list.hidden && event.key === 'Enter' && this.activeIndex >= 0) {
      event.preventDefault();
      this.select(this.activeIndex);
    } else if (!this.list.hidden && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  setActiveOption(index) {
    this.list.children[this.activeIndex]?.setAttribute('aria-selected', 'false');
    this.activeIndex = index;
    const option = this.list.children[index];
    option.setAttribute('aria-selected', 'true');
    this.input.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }

  select(index) {
    const contact = this.contacts[index];
    this.close();
    if (contact) this.onSelect(contact);
  }

  close() {
    this.list.hidden = true;
    this.list.replaceChildren();
    this.contacts = [];
    this.activeIndex = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
}
