# Shopping List App

A modern, real-time shopping list application built with Node.js, Express, and vanilla HTML/CSS/JS.

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
# Build and start the container in the background
docker compose up -d --build

# Access the app at http://localhost:8081
```

#### Using Docker CLI
If you prefer running the container manually:

```bash
# 1. Build the image
docker build -t shopping-list .

# 2. Create a volume for data persistence
docker volume create shopping_list_data

# 3. Run the container
# - Maps host port 8081 to container port 3000
# - Mounts the volume to /usr/src/app/data
docker run -d \
  -p 8081:3000 \
  -v shopping_list_data:/usr/src/app/data \
  --name shopping-list-app \
  shopping-list
```

## Technologies

- **Frontend**: HTML5, CSS3 (Variables, Flexbox, Animations), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.
- **Real-time**: Server-Sent Events (SSE).
- **Data**: JSON file-based persistence.
- **Containerization**: Docker.
