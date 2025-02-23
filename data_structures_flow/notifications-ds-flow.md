## Chat Thread Retrieval Flow

Key Points:

- Chat List Structure:

  - Stored in myData.chats array
  - Each chat entry contains latest message and contact info
  - Sorted by most recent message timestamp

- Contact Messages:

  - Full message history stored in contact.messages array
  - Includes both chat messages and payment transactions
  - Each message has timestamp and sender info

- Thread Loading:
  - When chat opened, loads messages from contact object
  - Updates UI with message history
  - Starts more frequent polling (5s intervals)

```mermaid
sequenceDiagram
    participant UI as Chat UI
    participant Data as myData
    participant Store as LocalStorage

    rect rgb(119, 101, 75)
        Note over UI: User clicks chat thread
        UI->>Data: 1. handleChatClick(contactAddress)
        Data->>Data: 2. Find contact in myData.contacts[address]
    end

    rect rgb(119, 101, 75)
        Note over UI: Load Message History
        Data->>UI: 3a. Load contact.messages[]
        UI->>UI: 3b. appendChatModal()<br/>Display messages in UI
        UI->>UI: 3c. Mark messages as read<br/>Update contact.unread = 0
    end

    rect rgb(119, 101, 75)
        Note over UI: Update Chat State
        UI->>Data: 4a. Set activeChatContact
        UI->>UI: 4b. Start pollChatInterval(5000)
        Data->>Store: 4c. Save updated unread count
    end

    Note over UI: Continue polling for<br/>new messages every 5s
```

## Chat Data Structure

```mermaid
classDiagram
    class myData {
        contacts: Map<address, Contact>
        chats: Chat[]
        activeChatContact: string
    }

    class Contact {
        address: string
        username: string
        messages: Message[]
        unread: number
        timestamp: number
    }

    class Chat {
        address: string
        lastMessage: string
        timestamp: number
        unread: number
    }

    class Message {
        message: string
        timestamp: number
        sent_timestamp: number
        my: boolean
    }

    myData --> Contact
    myData --> Chat
    Contact --> Message
```
