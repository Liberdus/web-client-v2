# Liberdus Secure Texting

A transparent, end-to-end encrypted web-based messaging application with a decentralized backend that prioritizes user privacy and security.

## Overview

Liberdus is a secure texting web application that implements end-to-end encryption to ensure your conversations remain private. Unlike many messaging platforms, Liberdus is fully transparent - users can inspect the actual code running on their device through the About page in the app. Also each message is encrypted independently using both classical encryption (ECDH) and post quantum encryption (ML-KEM-1024). Insted of a centralized backend run by a company, Liberdus uses a blockchain operated by a network of decentrazied nodes which anyone can join using a standard computer.

## Features

- Independent end-to-end double encryption for all messages with both classical and post quantum cryptography
- Web-based interface accessible from any modern browser
- No download or installation required
- No frameworks - pure HTML, JavaScript, and CSS for complete transparency
- Self-contained application with viewable source code on device
- Decentralized backend of community operated nodes
- Open-source and community-driven development

## Demo

Try out the application at [liberdus.com/test](https://liberdus.com/test)

## Development Setup

### Prerequisites

- Git
- Node.js and npm (for linting, formatting, and managing dependencies)
- A local HTTP server (such as Python's `http.server`, Node.js `http-server`, or any other of your choice)

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/Liberdus/liberdus
   cd liberdus
   ```

2. Install project dependencies (including those for linting and formatting):

   ```bash
   npm install
   ```

3. Start a local HTTP server in the cloned repository folder (this is the web client):

   Using Python:

   ```bash
   python -m http.server
   ```

   Or using Node.js http-server:

   ```bash
   npx http-server
   ```

4. Clone the proxy server repository (if you plan to run the full stack locally):

   ```bash
   git clone https://github.com/Liberdus/liberdus-proxy
   ```

5. Run the proxy server:

   ```bash
   cd liberdus-proxy
   # Follow the setup instructions in the proxy server README
   ```

6. Access the application in your browser at `http://localhost:8000` (or whichever port your HTTP server for the web client is using).

### Code Style and Quality

This project uses [ESLint](https://eslint.org/) for identifying and reporting on patterns in JavaScript and [Prettier](https://prettier.io/) for code formatting. These tools help maintain code quality and consistency.

**To use these tools:**

- First, ensure you have installed the development dependencies by running `npm install` in the `liberdus` (web-client) directory as described in the Installation section.

- **Linting:**

  - Check for linting errors:
    ```bash
    npm run lint
    ```
  - Attempt to automatically fix linting errors:
    ```bash
    npm run lint:fix
    ```

- **Formatting:**
  - Check for formatting issues:
    ```bash
    npm run format:check
    ```
  - Automatically format the code:
    ```bash
    npm run format
    ```

**Editor Integration:**
The project includes settings for VS Code (`.vscode/settings.json`) to automatically format code on save using Prettier and enable ESLint integration. For this to work, ensure you have the following VS Code extensions installed:

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) (by Microsoft)
- [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (by Prettier)

## Architecture

The application consists of two main components:

1. **Web Client**: Pure HTML, JS, and CSS files that run in the browser and handle the encryption/decryption of messages
2. **Proxy Server**: Manages message routing and delivery without ever having access to the unencrypted content

## Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-new-feature`
3. Make your changes
4. Test thoroughly
5. Commit your changes: `git commit -am 'Add some feature'`
6. Push to the branch: `git push origin feature/my-new-feature`
7. Submit a pull request

## Security

Security is our top priority. If you discover any security vulnerabilities, please report them responsibly by emailing security@liberdus.com instead of creating a public issue.

## Contact

Join our [Discord server](https://discord.gg/2cpJzFnwCR)
