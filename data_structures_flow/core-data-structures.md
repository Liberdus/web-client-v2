## Core Data Objects

```mermaid
classDiagram
    class myAccount {
        netid: string
        username: string
        chatTimestamp: number
        keys: AccountKeys
    }

    class AccountKeys {
        address: string
        public: string
        secret: string
        type: string
        pqSeed: string
    }

    class myData {
        timestamp: number
        account: AccountInfo
        network: NetworkInfo
        contacts: Map<address, Contact>
        chats: Chat[]
        wallet: WalletData
        state: AppState
        settings: Settings
    }

    class WalletData {
        networth: number
        timestamp: number
        priceTimestamp: number
        assets: Asset[]
        history: Transaction[]
    }

    class Asset {
        id: string
        name: string
        symbol: string
        img: string
        chainid: number
        contract: string
        price: number
        balance: bigint
        networth: number
        addresses: AssetAddress[]
    }

    class Transaction {
        txid: string
        amount: bigint
        sign: number
        timestamp: number
        address: string
        memo: string
    }

    class Settings {
        encrypt: boolean
        toll: number
    }

    class AccountInfo {
        netid: string
        username: string
        name: string
        email: string
        phone: string
        linkedin: string
        x: string
        keys: AccountKeys
    }

    class Contact {
        address: string
        username: string
        name: string
        messages: Message[]
        timestamp: number
        unread: number
        public: string
        pqPublic: string
        senderInfo: SenderInfo
    }

    class SenderInfo {
        username: string
        name: string
        email: string
        phone: string
        linkedin: string
        x: string
    }

    class Message {
        message: string
        timestamp: number
        sent_timestamp: number
        my: boolean
        type: string        // "chat" or "transaction"
        amount?: bigint     // Only for transactions
        asset?: string      // Only for transactions
        status?: string     // For transaction status
    }

    myAccount --> AccountKeys
    myData --> AccountInfo
    myData --> WalletData
    WalletData --> Asset
    WalletData --> Transaction
    myData --> Settings
    myData --> Contact
    Contact --> Message
    Contact "1" *-- "1" SenderInfo : contains
    Contact "1" *-- "*" Message : contains

    note for Contact "username/name are display fields\ncan exist without senderInfo"
    note for SenderInfo "Complete profile info\nonly exists after receiving message"
```

This initial diagram shows:

1. `myAccount`: The core user account object containing authentication and identity info
2. `myData`: The main data store containing all user data including:
   - Account information
   - Contacts and their messages
   - Chat history
   - Wallet data
