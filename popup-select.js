const MAX_VISIBLE_OPTIONS = 10;
const MAX_MENU_WIDTH = 360;
const MIN_MENU_WIDTH = 280;
const TRIGGER_GAP = 6;
const VIEWPORT_MARGIN = 8;
const SCROLL_INDICATOR_INSET = 8;
const SCROLL_INDICATOR_RIGHT_INSET = 3;
const SCROLL_INDICATOR_WIDTH = 4;
const MIN_SCROLL_THUMB_HEIGHT = 24;

let generatedId = 0;
let activePopupSelect = null;
const popupSelectInstances = new WeakMap();

export class PopupSelect {
  static from(select) {
    return popupSelectInstances.get(select) || null;
  }

  static visibleControl(control) {
    return PopupSelect.from(control)?.trigger || control;
  }

  constructor(select) {
    if (!select || select.tagName !== 'SELECT') {
      throw new TypeError('PopupSelect requires a select element');
    }

    this.select = select;
    this.isOpen = false;
    this.activeIndex = -1;
    this.positionFrame = null;
    this.originalTabIndex = select.getAttribute('tabindex');
    this.originalAriaHidden = select.getAttribute('aria-hidden');
    this.label = select.labels?.[0] || null;
    this.originalLabelFor = this.label?.getAttribute('for') ?? null;
    this.originalLabelId = this.label?.getAttribute('id') ?? null;

    if (!select.id) select.id = `popupSelect${++generatedId}`;
    if (this.label && !this.label.id) this.label.id = `${select.id}PopupLabel`;

    this.trigger = this.createTrigger();
    this.menu = this.createMenu();
    this.scrollIndicator = this.createScrollIndicator();

    this.handleTriggerClick = this.handleTriggerClick.bind(this);
    this.handleTriggerKeyDown = this.handleTriggerKeyDown.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
    this.handleMenuKeyDown = this.handleMenuKeyDown.bind(this);
    this.handleDocumentPointerDown = this.handleDocumentPointerDown.bind(this);
    this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
    this.schedulePosition = this.schedulePosition.bind(this);
    this.handleSelectChange = this.handleSelectChange.bind(this);
    this.updateScrollIndicator = this.updateScrollIndicator.bind(this);

    select.classList.add('popup-select__native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    popupSelectInstances.set(select, this);
    select.insertAdjacentElement('afterend', this.trigger);
    if (this.label) this.label.htmlFor = this.trigger.id;

    this.trigger.addEventListener('click', this.handleTriggerClick);
    this.trigger.addEventListener('keydown', this.handleTriggerKeyDown);
    this.menu.addEventListener('click', this.handleMenuClick);
    this.menu.addEventListener('keydown', this.handleMenuKeyDown);
    this.menu.addEventListener('scroll', this.updateScrollIndicator);
    select.addEventListener('change', this.handleSelectChange);

    this.refresh();
  }

  createTrigger() {
    const trigger = document.createElement('button');
    trigger.id = `${this.select.id}PopupTrigger`;
    trigger.className = 'form-control popup-select__trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${this.select.id}PopupListbox`);
    if (this.select.required) trigger.setAttribute('aria-required', 'true');

    const accessibleName = this.select.getAttribute('aria-label');
    const describedBy = this.select.getAttribute('aria-describedby');
    if (accessibleName) trigger.setAttribute('aria-label', accessibleName);
    else if (this.label) trigger.setAttribute('aria-labelledby', this.label.id);
    if (describedBy) trigger.setAttribute('aria-describedby', describedBy);

    this.value = document.createElement('span');
    this.value.className = 'popup-select__value';
    trigger.append(this.value);

    const chevron = document.createElement('span');
    chevron.className = 'popup-select__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    trigger.append(chevron);

    return trigger;
  }

  createMenu() {
    const menu = document.createElement('div');
    menu.id = `${this.select.id}PopupListbox`;
    menu.className = 'popup-select__menu';
    menu.tabIndex = -1;
    menu.setAttribute('role', 'listbox');

    const accessibleName = this.select.getAttribute('aria-label');
    if (accessibleName) menu.setAttribute('aria-label', accessibleName);
    else if (this.label) menu.setAttribute('aria-labelledby', this.label.id);

    return menu;
  }

  createScrollIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'popup-select__scroll-indicator';
    indicator.hidden = true;
    indicator.setAttribute('aria-hidden', 'true');

    this.scrollThumb = document.createElement('span');
    this.scrollThumb.className = 'popup-select__scroll-thumb';
    indicator.append(this.scrollThumb);
    return indicator;
  }

  refresh() {
    const selectedOption = this.select.options[this.select.selectedIndex];
    this.value.textContent = selectedOption?.textContent || '';
    this.trigger.disabled = this.select.disabled;
    this.menu.replaceChildren();

    [...this.select.options].forEach((option, index) => {
      const item = document.createElement('div');
      item.id = `${this.menu.id}Option${index}`;
      item.className = 'popup-select__option';
      item.dataset.optionIndex = String(index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === this.select.selectedIndex));
      if (option.disabled) item.setAttribute('aria-disabled', 'true');

      const label = document.createElement('span');
      label.className = 'popup-select__option-label';
      label.textContent = option.textContent;
      item.append(label);
      this.menu.append(item);
    });
  }

  open() {
    if (this.isOpen || this.select.disabled || this.select.options.length === 0) return;

    activePopupSelect?.dismiss();
    activePopupSelect = this;
    this.isOpen = true;
    this.refresh();
    this.activeIndex = this.getInitialActiveIndex();
    this.trigger.setAttribute('aria-expanded', 'true');
    this.menu.style.visibility = 'hidden';
    document.body.append(this.menu, this.scrollIndicator);

    document.addEventListener('pointerdown', this.handleDocumentPointerDown, true);
    document.addEventListener('keydown', this.handleDocumentKeyDown);
    document.addEventListener('scroll', this.schedulePosition, true);
    window.addEventListener('resize', this.schedulePosition);
    window.visualViewport?.addEventListener('resize', this.schedulePosition);
    window.visualViewport?.addEventListener('scroll', this.schedulePosition);

    this.positionMenu();
    this.menu.style.visibility = '';
    this.menu.focus({ preventScroll: true });
    this.setActiveIndex(this.activeIndex);
  }

  dismiss() {
    if (!this.isOpen) return;

    this.isOpen = false;
    if (activePopupSelect === this) activePopupSelect = null;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.menu.remove();
    this.scrollIndicator.hidden = true;
    this.scrollIndicator.remove();
    document.removeEventListener('pointerdown', this.handleDocumentPointerDown, true);
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    document.removeEventListener('scroll', this.schedulePosition, true);
    window.removeEventListener('resize', this.schedulePosition);
    window.visualViewport?.removeEventListener('resize', this.schedulePosition);
    window.visualViewport?.removeEventListener('scroll', this.schedulePosition);
    if (this.positionFrame !== null) cancelAnimationFrame(this.positionFrame);
    this.positionFrame = null;
  }

  close() {
    if (!this.isOpen) return;
    this.dismiss();
    this.focus();
  }

  destroy() {
    this.dismiss();
    this.trigger.removeEventListener('click', this.handleTriggerClick);
    this.trigger.removeEventListener('keydown', this.handleTriggerKeyDown);
    this.menu.removeEventListener('click', this.handleMenuClick);
    this.menu.removeEventListener('keydown', this.handleMenuKeyDown);
    this.menu.removeEventListener('scroll', this.updateScrollIndicator);
    this.select.removeEventListener('change', this.handleSelectChange);
    this.trigger.remove();

    this.select.classList.remove('popup-select__native');
    this.restoreAttribute('tabindex', this.originalTabIndex);
    this.restoreAttribute('aria-hidden', this.originalAriaHidden);
    if (this.label) {
      if (this.originalLabelFor === null) this.label.removeAttribute('for');
      else this.label.setAttribute('for', this.originalLabelFor);
      if (this.originalLabelId === null) this.label.removeAttribute('id');
      else this.label.setAttribute('id', this.originalLabelId);
    }
    popupSelectInstances.delete(this.select);
  }

  restoreAttribute(name, value) {
    if (value === null) this.select.removeAttribute(name);
    else this.select.setAttribute(name, value);
  }

  focus() {
    this.trigger.focus({ preventScroll: true });
  }

  getInitialActiveIndex() {
    if (this.select.selectedIndex >= 0 && !this.select.options[this.select.selectedIndex].disabled) {
      return this.select.selectedIndex;
    }
    return [...this.select.options].findIndex((option) => !option.disabled);
  }

  getLastEnabledIndex() {
    for (let index = this.select.options.length - 1; index >= 0; index -= 1) {
      if (!this.select.options[index].disabled) return index;
    }
    return -1;
  }

  setActiveIndex(index) {
    if (index < 0 || this.select.options[index]?.disabled) return;

    this.activeIndex = index;
    this.menu.querySelectorAll('.popup-select__option').forEach((item, itemIndex) => {
      item.classList.toggle('is-active', itemIndex === index);
    });

    const activeOption = this.menu.querySelector(`[data-option-index="${index}"]`);
    if (!activeOption) return;
    this.menu.setAttribute('aria-activedescendant', activeOption.id);
    this.scrollOptionIntoView(activeOption);
  }

  moveActiveIndex(direction) {
    let nextIndex = this.activeIndex;
    while (true) {
      const candidate = nextIndex + direction;
      if (candidate < 0 || candidate >= this.select.options.length) return;
      nextIndex = candidate;
      if (!this.select.options[nextIndex].disabled) {
        this.setActiveIndex(nextIndex);
        return;
      }
    }
  }

  scrollOptionIntoView(option) {
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;
    if (optionTop < this.menu.scrollTop) this.menu.scrollTop = optionTop;
    if (optionBottom > this.menu.scrollTop + this.menu.clientHeight) {
      this.menu.scrollTop = optionBottom - this.menu.clientHeight;
    }
    this.updateScrollIndicator();
  }

  selectActiveOption() {
    const option = this.select.options[this.activeIndex];
    if (!option || option.disabled) return;

    const changed = this.select.selectedIndex !== this.activeIndex;
    this.select.selectedIndex = this.activeIndex;
    this.close();
    if (changed) this.select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  positionMenu() {
    if (!this.isOpen) return;

    const triggerRect = this.trigger.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewport = {
      left: visualViewport?.offsetLeft ?? 0,
      top: visualViewport?.offsetTop ?? 0,
      right: (visualViewport?.offsetLeft ?? 0) + (visualViewport?.width ?? window.innerWidth),
      bottom: (visualViewport?.offsetTop ?? 0) + (visualViewport?.height ?? window.innerHeight),
    };
    const availableWidth = Math.max(0, viewport.right - viewport.left - VIEWPORT_MARGIN * 2);
    const menuWidth = Math.min(
      Math.max(Math.ceil(triggerRect.width), MIN_MENU_WIDTH),
      MAX_MENU_WIDTH,
      availableWidth,
    );

    this.menu.style.width = `${menuWidth}px`;
    this.menu.style.maxHeight = '';

    const computedStyle = window.getComputedStyle(this.menu);
    const verticalPadding = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
    const verticalBorder = parseFloat(computedStyle.borderTopWidth) + parseFloat(computedStyle.borderBottomWidth);
    const visibleOptionHeight = [...this.menu.children]
      .slice(0, MAX_VISIBLE_OPTIONS)
      .reduce((height, item) => height + item.getBoundingClientRect().height, 0);
    const desiredHeight = Math.min(this.menu.scrollHeight, visibleOptionHeight + verticalPadding) + verticalBorder;
    const spaceBelow = Math.max(0, viewport.bottom - VIEWPORT_MARGIN - triggerRect.bottom - TRIGGER_GAP);
    const spaceAbove = Math.max(0, triggerRect.top - viewport.top - VIEWPORT_MARGIN - TRIGGER_GAP);
    const opensAbove = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableHeight = opensAbove ? spaceAbove : spaceBelow;

    this.menu.style.maxHeight = `${Math.floor(Math.min(desiredHeight, availableHeight))}px`;
    const menuRect = this.menu.getBoundingClientRect();
    const minLeft = viewport.left + VIEWPORT_MARGIN;
    const maxLeft = viewport.right - VIEWPORT_MARGIN - menuRect.width;
    const left = Math.max(minLeft, Math.min(maxLeft, triggerRect.left));
    const top = opensAbove
      ? triggerRect.top - TRIGGER_GAP - menuRect.height
      : triggerRect.bottom + TRIGGER_GAP;

    this.menu.dataset.placement = opensAbove ? 'above' : 'below';
    this.menu.style.left = `${Math.round(left)}px`;
    this.menu.style.top = `${Math.round(top)}px`;
    this.updateScrollIndicator();
  }

  updateScrollIndicator() {
    const scrollRange = this.menu.scrollHeight - this.menu.clientHeight;
    if (!this.isOpen || scrollRange <= 1) {
      this.scrollIndicator.hidden = true;
      return;
    }

    const menuRect = this.menu.getBoundingClientRect();
    const trackHeight = Math.max(0, menuRect.height - SCROLL_INDICATOR_INSET * 2);
    const thumbHeight = Math.min(
      trackHeight,
      Math.max(
        MIN_SCROLL_THUMB_HEIGHT,
        trackHeight * (this.menu.clientHeight / this.menu.scrollHeight),
      ),
    );
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);
    const scrollProgress = Math.min(1, Math.max(0, this.menu.scrollTop / scrollRange));
    const thumbTop = thumbTravel * scrollProgress;

    this.scrollIndicator.hidden = false;
    this.scrollIndicator.style.height = `${Math.round(trackHeight)}px`;
    this.scrollIndicator.style.left = `${Math.round(
      menuRect.right - SCROLL_INDICATOR_RIGHT_INSET - SCROLL_INDICATOR_WIDTH,
    )}px`;
    this.scrollIndicator.style.top = `${Math.round(menuRect.top + SCROLL_INDICATOR_INSET)}px`;
    this.scrollThumb.style.height = `${Math.round(thumbHeight)}px`;
    this.scrollThumb.style.top = `${Math.round(thumbTop)}px`;
  }

  schedulePosition(event) {
    if (event?.target === this.menu) return;
    if (!this.isOpen || this.positionFrame !== null) return;
    this.positionFrame = requestAnimationFrame(() => {
      this.positionFrame = null;
      this.positionMenu();
    });
  }

  handleSelectChange() {
    this.refresh();
    if (this.isOpen) this.setActiveIndex(this.getInitialActiveIndex());
  }

  handleTriggerClick() {
    if (this.isOpen) this.close();
    else this.open();
  }

  handleTriggerKeyDown(event) {
    if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    this.open();
  }

  handleMenuClick(event) {
    const option = event.target.closest('.popup-select__option');
    if (!option || option.getAttribute('aria-disabled') === 'true') return;
    this.setActiveIndex(Number(option.dataset.optionIndex));
    this.selectActiveOption();
  }

  handleMenuKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActiveIndex(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActiveIndex(-1);
        break;
      case 'Home':
        event.preventDefault();
        this.setActiveIndex([...this.select.options].findIndex((option) => !option.disabled));
        break;
      case 'End':
        event.preventDefault();
        this.setActiveIndex(this.getLastEnabledIndex());
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectActiveOption();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  handleDocumentPointerDown(event) {
    if (this.trigger.contains(event.target) || this.menu.contains(event.target)) return;
    this.dismiss();
  }

  handleDocumentKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.close();
  }
}
