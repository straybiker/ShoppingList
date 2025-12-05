# Shopping List App

A modern, real-time shopping list application built with Node.js, Express, and vanilla HTML/CSS/JS.

<img width="256" height="256" alt="shoppinglist_sqr" src="https://github.com/user-attachments/assets/d07dd3c2-c0ea-476c-875d-589a2ac9ec9e" />

## Features

- **Real-time Synchronization**: Updates appear instantly across all connected devices using Server-Sent Events (SSE).
- **User Profiles**: Create a unique username and display name to identify yourself to others.
- **Favorites System**: Save your frequently used lists to your profile for quick access.
- **Smart Sharing**: Easily share lists with friends via generated links.
- **State Persistence**: Your current list and user identity are saved locally, so you pick up right where you left off.
- **Backend Storage**: Lists are saved persistently on the server (JSON file storage).
- **Slash Commands**:
  - `/clear-cache`: Instantly delete all items in the current list.
  - `/config-lists`: Enter configuration mode to manage and delete existing lists.
  - `/config-users`: Enter user configuration mode to view and manage users.
- **Smart UI**:
  - **Mobile-First Layout**: Fixed header and input box with an endless scrolling list.
  - **Modern Aesthetics**: Dark premium theme with glassmorphism effects and clean, borderless inputs.
  - **Responsive Design**: Optimized for both mobile and desktop experiences.
  - **Interactive Feedback**: Toast notifications and smooth transitions.
- **List Management**:
  - Add, edit, and delete items.
  - Mark items as completed.
  - "Delete Completed" button to clean up the list.
  - Sort items alphabetically.
- **Security & Performance**:
  - Rate limiting (100 requests/15 min per IP).
  - Input validation.
  - Write queue system for concurrent updates.

## Usage & Deep Linking

The app now persists your session (User and List) in the browser's `localStorage`. URL parameters are primarily used for sharing and deep linking.

### Sharing Lists
To share a list, simply send the URL with the `list` parameter:
```
http://localhost:3000/?list=party_supplies
```
When a user opens this link, they will join that list.

### User Identity
You can set your username and display name on the **Profile Page** (accessible via the user icon in the top right).
- **Username**: Unique identifier.
- **Display Name**: What others see when you add items.

Legacy URL parameters for user setting (`?user=John`) are still supported for quick initialization but are no longer required for every visit.

## Installation & Running

### Getting the Code

Navigate to your desired installation directory (e.g., `/opt` on a server) and clone the repository:
```bash
cd /opt
git clone https://github.com/straybiker/ShoppingList.git
cd ShoppingList
```

### Local Development

1. **Prerequisites**: Ensure Node.js (v18 or higher) is installed.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Start the Server**:
   ```bash
   npm start
   ```
   The server will start on **port 3000** by default.
4. **Access the App**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

#### Using Docker Compose (Recommended)
This method automatically handles the build and sets up data persistence.

```bash
# 1. Get the latest code
git pull

# 2. Build and start the container in the background
docker compose up -d --build

# Access the app at http://localhost:3000
```

#### Using Docker CLI
If you prefer running the container manually:

```bash
# 1. Build the image
docker build -t shopping-list .

# 2. Create a volume for data persistence
docker volume create shopping_list_data

# 3. Run the container
# - Maps host port 80 to container port 3000
# - Mounts the volume to /usr/src/app/data
docker run -d \
  -p 80:3000 \
  -v shopping_list_data:/usr/src/app/data \
  --name shopping-list \
  shopping-list
```

### Solid Deployment Process (LXC + Portainer)

This process ensures your app is always up-to-date, your data is safe, and Portainer reflects the correct state.

**1. Update Code (via SSH)**
Connect to your LXC host and pull the latest changes:
```bash
cd ShoppingList
git pull
```

**2. Build & Deploy (via SSH)**
Since you are building the image locally, run this command on the LXC host. It handles building the image and recreating the container in one step:
```bash
docker compose up -d --build
```

**3. Portainer Management**
Portainer will automatically see the updated container. You can use Portainer to:
- **Monitor logs**: Check for errors.
- **Restart**: If needed.
- **Console**: Access the container shell.

**⚠️ IMPORTANT:**
- **Data Safety**: The `docker-compose.yml` now includes `volumes: - shopping_list_data:/usr/src/app/data`. This guarantees your lists are safe during updates.
- **Port**: The app is now exposed on **Port 80** of the LXC container.

## Technologies

- **Frontend**: HTML5, CSS3 (Variables, Flexbox, Animations), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.
- **Real-time**: Server-Sent Events (SSE).
- **Data**: JSON file-based persistence.
- **Containerization**: Docker.
