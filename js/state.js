class State {
  constructor() {
    this.state = {
      isAuthenticated: localStorage.getItem("authenticated") === "true",
      currentPage: "chats",
      currentAddress: null,
      timestamp: "2024-12-23T02:33:44.512Z",
      account: {},
      network: {},
      wallet: {},
      contacts: {},
      chats: [],
      unread: 0,
      settings: {
        toll: true,
        encrypt: true,
      },
    };
  }

  getState() {
    return this.state;
  }

  updateState(newState) {
    // console.log("Existing state:", this.state);
    // console.log("Updating state:", newState);
    this.state = {
      ...this.state,
      ...newState,
      currentPage: this.state.currentPage,
      currentAddress: this.state.currentAddress,
      isAuthenticated: this.state.isAuthenticated,
    };
    // console.log("Updated state:", this.state);

    this.render();
  }

  navigate(page) {
    if (page.startsWith("/chats/")) {
      this.state.currentAddress = page.split("/")[2];
      this.state.currentPage = "chat-view";
    } else {
      this.state.currentPage = page;
      this.state.currentAddress = null;
    }
    this.render();
  }

  authenticate() {
    this.state.isAuthenticated = true;
    localStorage.setItem("authenticated", "true");
    this.navigate("chats");
  }

  logout() {
    this.state.isAuthenticated = false;
    localStorage.removeItem("authenticated");
    this.navigate("auth");
  }

  render() {
    const root = document.getElementById("root");

    if (!this.state.isAuthenticated) {
      switch (this.state.currentPage) {
        case "sign-in":
          renderCreateAccount();
          break;
        case "recovery-key":
          renderRecoveryKey();
          break;
        case "import":
          renderImportAccount();
          break;
        default:
          renderGetStarted();
          break;
      }
      this.hideBottomNav();
      return;
    }

    switch (this.state.currentPage) {
      case "chats":
        renderChats();
        this.showBottomNav();
        break;
      case "chat-view":
        renderChatView(this.state.currentAddress);
        this.hideBottomNav();
        break;
      case "contacts":
        renderContacts();
        this.showBottomNav();
        break;
      case "wallet":
        renderWallet();
        this.showBottomNav();
        break;
      case "send":
        renderSendPage();
        this.hideBottomNav();
        break;
      case "account":
        renderAccount();
        this.showBottomNav();
        break;
      case "import":
        renderImportPage();
        this.hideBottomNav();
        break;
      default:
        renderChats();
        this.showBottomNav();
        break;
    }

    // Update active nav item
    document.querySelectorAll(".nav-item").forEach((item) => {
      const page = item.getAttribute("data-page");
      item.classList.toggle("active", page === this.state.currentPage);
    });
  }

  hideBottomNav() {
    const bottomNav = document.querySelector(".bottom-nav");
    bottomNav.classList.add("hidden");
  }

  showBottomNav() {
    const bottomNav = document.querySelector(".bottom-nav");
    bottomNav.classList.remove("hidden");
  }
}
