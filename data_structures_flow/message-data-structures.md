## Message Data Structures

```mermaid
classDiagram
    class MessagePayload {
        message: string
        encrypted: boolean
        encryptionMethod: string
        public: string
        pqEncSharedKey: string
        sent_timestamp: number
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

    class TransactionMessage {
        type: string
        from: string
        to: string
        amount: bigint
        chatId: string
        message: string
        xmessage: MessagePayload
        timestamp: number
        network: string
        fee: bigint
        sign: SignatureData
    }

    class SignatureData {
        owner: string
        sig: string
    }

    class ProcessedMessage {
        message: string
        timestamp: number
        sent_timestamp: number
        my: boolean
    }

    MessagePayload --> SenderInfo
    TransactionMessage --> MessagePayload
    TransactionMessage --> SignatureData
```

## Message Flow with Data

Key Points:

- Message Creation:

  - Sender creates MessagePayload with encrypted content
  - Wraps payload in TransactionMessage for network transmission
  - Adds toll payment and signatures

- Data Transformation:

  - Raw message → Encrypted MessagePayload → Signed TransactionMessage
  - Network processes transaction and toll payment
  - Recipient decrypts back to ProcessedMessage format

- Storage:
  - Final message stored in recipient's contact.messages array
  - Updates chat list and unread counts
  - Maintains original timestamps for ordering

```mermaid
sequenceDiagram
    participant Sender as Sender App
    participant Gateway as Network Gateway
    participant Recipient as Recipient App
    participant DB as LocalStorage

    rect rgb(119, 101, 75)
        Note over Sender: Message Creation
        Sender->>Sender: handleSendMessage()<br/>1. Create payload with message
        Sender->>Sender: 2. Encrypt with recipient's keys<br/>using hybrid encryption
    end

    rect rgb(119, 101, 75)
        Note over Sender: Transaction Preparation
        Sender->>Sender: 3. Create TransactionMessage:<br/>- type: "message"<br/>- xmessage: encrypted payload<br/>- chatId: hash(from+to)<br/>- toll payment: 1
    end

    Sender->>Gateway: 4. postChatMessage(TransactionMessage)

    rect rgb(119, 101, 75)
        Note over Recipient: Message Processing
        Recipient->>Recipient: 5a. processChats()<br/>- Decrypt message<br/>- Update contact.messages<br/>- Update contact.unread
        Recipient->>DB: 5b. Save to localStorage
        Recipient->>Recipient: 5c. updateChatList()<br/>- Update UI if chat open<br/>- Show notifications
    end
```

## Message Discovery Flow

Key Points:

- Polling Strategy:

  - Regular checks for new messages via pollChats()
  - 5-second intervals when actively chatting (pollIntervalChatting)
  - 30-second intervals when idle (pollIntervalNormal)
  - Uses chatTimestamp to only fetch new messages

- Two-Step Message Retrieval:

  - Step 1: Get list of new messages by sender
  - Step 2: Process messages and update UI
  - Handles both chat messages and payment transfers

- Message Processing:
  - Decrypts messages using hybrid encryption
  - Updates contact.unread count
  - Updates myData.chats order
  - Saves to localStorage

```mermaid
sequenceDiagram
    participant App as Recipient App
    participant Gateway as Network Gateway
    participant DB as LocalStorage

    rect rgb(119, 101, 75)
        Note over App: Poll Interval Check
        App->>App: pollChatInterval()<br/>5s chatting / 30s idle
    end

    App->>Gateway: 1. getChats(myAccount.address,<br/>myAccount.chatTimestamp)
    Gateway-->>App: 2. Returns chat messages<br/>and payment transfers

    Note over App: If no new messages,<br/>continue polling

    alt Has New Messages
        rect rgb(119, 101, 75)
            Note over App: processChats()
            loop For each message
                App->>App: 3a. decryptMessage()<br/>if message.encrypted
                App->>App: 3b. Update contact.messages<br/>Update contact.unread
                App->>App: 3c. Update myData.chats order
                App->>DB: 3d. Save to localStorage
            end
        end

        rect rgb(119, 101, 75)
            Note over App: UI Updates
            App->>App: 4a. appendChatModal()<br/>if chat open
            App->>App: 4b. updateChatList()<br/>if chats view active
            App->>App: 4c. Update myAccount.chatTimestamp
        end
    end
```

## Sequence Diagram Example

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob

    %% Solid arrow for request
    A->>B: Hello Bob!

    %% Dashed arrow for response
    B-->>A: Hi Alice!

    %% Note over one participant
    Note over A: Alice thinks

    %% Note over multiple participants
    Note over A,B: They are greeting

    %% Alternative path (dotted box)
    alt is morning
        A->>B: Good morning!
    end
```
