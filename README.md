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
- Node.js and npm (for development tools)
- A local HTTP server (such as Python's `http.server`, Node.js `http-server`, or any other of your choice)

### Installation

1. Clone this repository:

   ```
   git clone https://github.com/Liberdus/liberdus
   cd liberdus
   ```

2. Install development dependencies (for linting and formatting):

   ```
   npm install
   ```

3. Start a local HTTP server in the cloned repository folder:

   Using Python:

   ```
   python -m http.server
   ```

   Or using Node.js http-server:

   ```
   npx http-server
   ```

4. Optionally you can also run a local proxy server (like RPC server in Ethereum). This is not required since you can configure to use an existing remote proxy server.

If you want to setup your own proxy server see https://github.com/Liberdus/liberdus-proxy

5. Optionally you can also run a local network of validator and archive nodes. This is not required if you configure your web client to use a remote proxy server. 

If you want to setup your own local network of validators and archivers see https://github.com/liberdus/server

6. Configure the network.js file. If you are running your own proxy server see the network.js_loc file to see how the `gateways` field should be set. If you are using the default proxy server then no changes have to be made to this file.

7. Access the application in your browser at `http://localhost:8000` (or whichever port your HTTP server is using)

## Architecture

The application consists of four main components:

1. **Web Client**: Pure HTML, JS, and CSS files that run in the browser and handle the encryption/decryption of messages
2. **Proxy Server**: Manages message routing and delivery without ever having access to the unencrypted content; like RPC servers in Ethereum
3. **Validator Nodes**: Provide redundant and sharded storage of the application state as well as consensus on new transactions that change the state
4. **Archive Servers**: Provide long term storage of transaction history

## Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository: click the `Fork` button at the top right of this page
2. Clone your forked repo: `git clone https://github.com/your-username/repo-name.git`
3. Create a new branch: `git checkout -b my-new-branch`
4. Make your changes
5. Test thoroughly
6. Commit your changes: `git add .` then `git commit -am 'Add some feature'`
7. Push to the branch: `git push origin my-new-branch`
8. Submit a pull request: from your forked github repo click `Compare & pull request`

### Code Style

Although the project has ESLint and Prettier to maintain consistent code formatting, they are currently not used. Try to keep your code style consistent with the existing code. In the future linting and formatting rules will automatically be applied when you save files in VS Code.

**VS Code Setup:**

- You can skip this for now
- Install the ESLint and Prettier extensions
- The project includes VS Code settings that will automatically format your code on save

**Manual Commands:**

You can skip this for now

```bash
# Check for linting errors
npm run lint

# Auto-fix linting errors
npm run lint:fix

# Format code with Prettier
npm run format

# Check if code is properly formatted
npm run format:check
```

**Git Blame and Linting:**

To preserve meaningful git blame history, this project uses `.git-blame-ignore-revs` to ignore linting/formatting setup commits. Git is configured to automatically ignore these commits:

```bash
# View blame ignoring linting setup commits (automatic)
git blame <filename>

# Manual usage if needed
git blame --ignore-revs-file .git-blame-ignore-revs <filename>
```

## Security

Security is our top priority. If you discover any security vulnerabilities, please report them responsibly by emailing security@liberdus.com instead of creating a public issue.

## Contact

Join our [Discord server](https://discord.gg/2cpJzFnwCR)
