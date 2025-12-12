# <img width="56" height="56" alt="shoppinglist_sqr" src="https://github.com/user-attachments/assets/d07dd3c2-c0ea-476c-875d-589a2ac9ec9e" /> Shopping List App

A modern, real-time shopping list application built with **React**, **Node.js**, **Express**, and **Docker**.

## Screenshots
<img width="376" height="483" alt="image" src="https://github.com/user-attachments/assets/e9af616f-0968-4234-b7aa-b92f2c12be14" />
<img width="372" height="448" alt="image" src="https://github.com/user-attachments/assets/39c961a6-85e5-42a4-b2e6-2d70af4294a8" />
<img width="376" height="422" alt="image" src="https://github.com/user-attachments/assets/121049c7-2dad-4141-a5f9-48364e6dfd1d" />




## Features

- **Real-time Synchronization**: Updates appear instantly across all devices (SSE).
- **Dashboard**: Manage multiple lists, mark favorites, and share link.
- **Smart Interactions**:
  - **Slide-to-Delete**: Swipe items/lists to delete (preventing accidents).
  - **Share Links**: One-tap sharing via system sheet or clipboard.
- **User Profiles**: Custom usernames and display names.
- **Modern UI**: Dark mode, glassmorphism, responsive mobile-first design.
- **Persistent Data**: File-based JSON storage with Docker volume persistence.

## Slash Commands
You can type these commands directly into the item input box:
- `/clear-cache`: Instantly delete all items in the current list.
- `/config-lists`: Enter configuration mode to manage existing lists.
- `/config-users`: Enter user configuration mode to view and manage users.

## Sharing Lists
To share a list, the user first has to log in on the app and then open the shared list.

## Deployment

### Docker (Recommended)

The easiest way to deploy is using Docker Compose. This allows you to run the app with a single command.

#### Prerequisites
- Docker & Docker Compose installed.

#### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/straybiker/ShoppingList.git
   cd ShoppingList
   ```

2. **Start the application**:
   ```bash
   docker compose up -d --build
   ```
   This will build the React frontend, set up the backend, and expose the app on **Port 80**.

3. **Access**:
   Open `http://localhost` (or your server IP) in your browser.

### Data Persistence
Data is stored in a Docker volume `shopping_list_data` mapped to `/usr/src/app/data`. Your lists are safe even if you rebuild the container.

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install && cd client && npm install
   ```

2. **Run Dev Server**:
   ```bash
   # Terminal 1: Root directory (runs server)
   npm start
   
   # Terminal 2: client/ directory (runs React dev server)
   cd client && npm run dev
   ```

   The app will be available at `http://localhost:5173`.

## Technologies
- **Frontend**: React, Vite, Tailwind-inspired CSS.
- **Backend**: Node.js, Express.
- **Infrastructure**: Docker, Nginx (optional/proxied).
