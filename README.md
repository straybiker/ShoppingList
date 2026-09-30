<p align=center>
  <img width="128" height="128" alt="shoppinglist_sqr" src="https://github.com/user-attachments/assets/d07dd3c2-c0ea-476c-875d-589a2ac9ec9e" /> 
</p>

# ShoppingList

**Share you shopping list**

A modern, real-time sharebale shopping list application built with **React**, **Node.js**, **Express**, and **Docker**.

## Screenshots
<img width="376" height="483" alt="image" src="https://github.com/user-attachments/assets/e9af616f-0968-4234-b7aa-b92f2c12be14" />
<img width="372" height="448" alt="image" src="https://github.com/user-attachments/assets/39c961a6-85e5-42a4-b2e6-2d70af4294a8" />
<img width="376" height="422" alt="image" src="https://github.com/user-attachments/assets/121049c7-2dad-4141-a5f9-48364e6dfd1d" />




## Features

- **No login**: No accounts and no passwords. The list link is the key.
- **Real-time Synchronization**: Updates appear instantly across all devices (SSE).
- **Dashboard**: "Your lists" is stored on the device. A list you open or create is added automatically.
- **Smart Interactions**:
  - **Slide-to-Delete**: Swipe an item to delete it. Swipe a list on the dashboard to remove it from this device only.
  - **Delete with undo**: Deleting a list (trash icon in the list header) asks for confirmation, offers Undo, and keeps the list restorable for 30 days.
  - **Share Links**: One-tap sharing via system sheet or clipboard.
- **Optional name**: Set a nickname once; it shows next to the items you add.
- **Modern UI**: Dark mode, glassmorphism, responsive mobile-first design.
- **Persistent Data**: File-based JSON storage with Docker volume persistence.

## Sharing Lists
Share the list link. Anyone who has the link can see and edit the list, so share it only with people you trust. New list links carry 128 random bits and cannot be guessed.

## Slash Commands
You can type these commands directly into the item input box:
- `/clear-cache`: Delete all items in the current list (asks for confirmation).
- `/config-lists`: Admin view of all lists. Needs the admin token (see below).

## Admin Mode
The admin view is off by default. To enable it, give the server a token:
- `ADMIN_TOKEN`: set it in a local `.env` file next to `docker-compose.yml`. Never commit this file.
- `ADMIN_TOKEN_FILE`: path to a file with the token, for example a Docker secret in `/run/secrets/`.

Without a token, the admin API answers `404`.

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
   This will build the React frontend, set up the backend, and expose the app on **Port 3000**.

3. **Access**:
   Open `http://localhost:3000` (or your server IP) in your browser.

### Data Persistence
Data is stored in a Docker volume `shopping_list_data` (full name: `<project>_shopping_list_data`, e.g. `shoppinglist_shopping_list_data`) mapped to `/usr/src/app/data`. Your lists are safe even if you rebuild the container.

### Upgrading from a version with usernames
- **File ownership**: the container now runs as user `node` (UID 1000), not as root. Files in an existing volume were written by root. Give them to `node` once, before you start the new version:
  ```bash
  docker run --rm -v shoppinglist_shopping_list_data:/data alpine chown -R 1000:1000 /data
  ```
- **Favorites**: on the first visit, each device moves the favorites of its old username into the local "Your lists". Old list links keep working.

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
